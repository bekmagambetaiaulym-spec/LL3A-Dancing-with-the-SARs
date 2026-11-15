import glob, os, re, json
import h5py, numpy as np, rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds
from PIL import Image

W, S, E, N = 66.15, 36.80, 67.90, 37.25
RES = 50  
OUT = "web/images"
os.makedirs(OUT, exist_ok=True)

mx0, my0, mx1, my1 = transform_bounds("EPSG:4326", "EPSG:3857", W, S, E, N)
width = int((mx1 - mx0) / RES)
height = int((my1 - my0) / RES)
dst_transform = from_origin(mx0, my1, RES, RES)
print("Image size:", width, "x", height)

def to_png(db, path, lo, hi):
    valid = np.isfinite(db)
    v = np.clip((np.nan_to_num(db) - lo) / (hi - lo), 0, 1)
    rgba = np.zeros((height, width, 4), dtype="uint8")
    rgba[..., :3] = (v * 255).astype("uint8")[..., None]
    rgba[..., 3] = np.where(valid, 255, 0)
    Image.fromarray(rgba).save(path)
    print("   saved:", path)

def empty():
    return np.full((height, width), np.nan, dtype="float32")


for f in sorted(glob.glob("data/NISAR*")):
    match = re.search(r"_(\d{8})T", os.path.basename(f))
    if not match:
        continue
    date = match.group(1)
    print("\n== NISAR", date)
    with h5py.File(f) as h:
        g = h["science/LSAR/GCOV/grids/frequencyA"]
        epsg = int(g["projection"][()])
        x = g["xCoordinates"][:]
        y = g["yCoordinates"][:]
        step = RES // 10
        ux0, uy0, ux1, uy1 = transform_bounds("EPSG:4326", CRS.from_epsg(epsg), W, S, E, N)
        xi = np.where((x >= ux0) & (x <= ux1))[0]
        yi = np.where((y >= uy0) & (y <= uy1))[0]
        if len(xi) == 0 or len(yi) == 0:
            print("   area is outside the scene, skipping"); continue
        i0, i1 = xi.min(), xi.max() + 1
        j0, j1 = yi.min(), yi.max() + 1
        src_transform = from_origin(x[i0] - 5, y[j0] + 5, 10 * step, 10 * step)
        for pol in ("HHHH", "HVHV"):
            if pol not in g:
                continue
            a = g[pol][j0:j1:step, i0:i1:step].astype("float32")
            with np.errstate(divide="ignore", invalid="ignore"):
                db = 10 * np.log10(a)
            db[~np.isfinite(db)] = np.nan
            dst = empty()
            reproject(db, dst, src_transform=src_transform,
                      src_crs=CRS.from_epsg(epsg),
                      dst_transform=dst_transform, dst_crs="EPSG:3857",
                      src_nodata=np.nan, dst_nodata=np.nan,
                      resampling=Resampling.bilinear)
            lo, hi = np.nanpercentile(dst, (2, 98))
            to_png(dst, f"{OUT}/nisar_{date}_{pol}.png", lo, hi)

b = transform_bounds("EPSG:3857", "EPSG:4326", mx0, my0, mx1, my1)
json.dump({"west": b[0], "south": b[1], "east": b[2], "north": b[3]},
          open("web/bounds.json", "w"))
print("\nMap bounds:", b)