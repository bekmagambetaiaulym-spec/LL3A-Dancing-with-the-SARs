import glob, os, re
import h5py, numpy as np, rasterio
from rasterio.crs import CRS
from rasterio.warp import transform_bounds
from PIL import Image

OUT = "web/images"
os.makedirs(OUT, exist_ok=True)

def save_png(arr, path, lo, hi):
    arr = np.clip((arr - lo) / (hi - lo), 0, 1)
    arr = np.nan_to_num(arr, nan=0.0)
    Image.fromarray((arr * 255).astype("uint8")).save(path)
    print("   сохранено:", path)


for f in sorted(glob.glob("data/NISAR*")):
    date = re.search(r"_(\d{8})T", os.path.basename(f)).group(1)
    print("\n== NISAR", date)
    with h5py.File(f) as h:
        g = h["science/LSAR/GCOV/grids/frequencyA"]
        epsg = int(g["projection"][()])
        x = g["xCoordinates"][:]
        y = g["yCoordinates"][:]
        print("   EPSG:", epsg, "| шаг пикселя (м):", float(g["xCoordinateSpacing"][()]))
        west, south, east, north = transform_bounds(
            CRS.from_epsg(epsg), "EPSG:4326",
            x.min(), y.min(), x.max(), y.max())
        print("   ГРАНИЦЫ (lon/lat): запад %.4f юг %.4f восток %.4f север %.4f"
              % (west, south, east, north))
        for pol, lo, hi in (("HHHH", -25, 0), ("HVHV", -30, -5)):
            a = g[pol][::16, ::16].astype("float32")
            with np.errstate(divide="ignore", invalid="ignore"):
                db = 10 * np.log10(a)
            save_png(db, f"{OUT}/preview_nisar_{date}_{pol}.png", lo, hi)


for f in sorted(glob.glob("data/s1a*")):
    name = os.path.basename(f)
    pol = "vh" if "-vh-" in name else "vv"
    print("\n== Sentinel-1", pol.upper())
    with rasterio.open(f) as r:
        gcps, crs = r.gcps
        lons = [p.x for p in gcps]
        lats = [p.y for p in gcps]
        print("   GCP CRS:", crs)
        print("   ГРАНИЦЫ (lon/lat): запад %.4f юг %.4f восток %.4f север %.4f"
              % (min(lons), min(lats), max(lons), max(lats)))
        a = r.read(1, out_shape=(r.height // 8, r.width // 8)).astype("float32")
        v = np.log10(a + 1)
        lo, hi = np.percentile(v[a > 0], (2, 98))
        save_png(v, f"{OUT}/preview_s1_{pol}.png", lo, hi)