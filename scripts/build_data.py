import glob, os, json, warnings
import h5py, numpy as np
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds
from PIL import Image


W, S, E, N = 66.15, 36.80, 67.90, 37.25   
RES = 50                                   
SAME_CONTRAST = False                      
T_SMALL = 1.5                              
T_BIG = 4.0                               
BLOCK = 100                               
OUT = "web/images"
os.makedirs(OUT, exist_ok=True)

mx0, my0, mx1, my1 = transform_bounds("EPSG:4326", "EPSG:3857", W, S, E, N)
width = int((mx1 - mx0) / RES)
height = int((my1 - my0) / RES)
dst_transform = from_origin(mx0, my1, RES, RES)
px_km2 = (RES * np.cos(np.radians(37.0)) / 1000) ** 2
print("Image size:", width, "x", height)



def stretch(a):
    """Contrast range of one picture (2nd to 98th percentile)."""
    return np.nanpercentile(a, (2, 98))


def shared(a, b):
    """One contrast range for BOTH dates."""
    both = np.concatenate([a[np.isfinite(a)], b[np.isfinite(b)]])
    return np.percentile(both, (2, 98))


def save_grey(db, path, p):
    valid = np.isfinite(db)
    v = np.clip((np.nan_to_num(db) - p[0]) / (p[1] - p[0]), 0, 1)
    rgba = np.zeros((height, width, 4), dtype="uint8")
    rgba[..., :3] = (v * 255).astype("uint8")[..., None]
    rgba[..., 3] = np.where(valid, 255, 0)
    Image.fromarray(rgba).save(path)
    print("   saved:", path)


def load_db(path, pol):
    with h5py.File(path) as h:
        gr = h["science/LSAR/GCOV/grids/frequencyA"]
        epsg = int(gr["projection"][()])
        x = gr["xCoordinates"][:]
        y = gr["yCoordinates"][:]
        step = RES // 10
        ux0, uy0, ux1, uy1 = transform_bounds("EPSG:4326", CRS.from_epsg(epsg), W, S, E, N)
        xi = np.where((x >= ux0) & (x <= ux1))[0]
        yi = np.where((y >= uy0) & (y <= uy1))[0]
        i0, i1 = xi.min(), xi.max() + 1
        j0, j1 = yi.min(), yi.max() + 1
        src_transform = from_origin(x[i0] - 5, y[j0] + 5, 10 * step, 10 * step)
        a = gr[pol][j0:j1:step, i0:i1:step].astype("float32")
    with np.errstate(divide="ignore", invalid="ignore"):
        db = 10 * np.log10(a)
    db[~np.isfinite(db)] = np.nan
    dst = np.full((height, width), np.nan, dtype="float32")
    reproject(db, dst, src_transform=src_transform, src_crs=CRS.from_epsg(epsg),
              dst_transform=dst_transform, dst_crs="EPSG:3857",
              src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.bilinear)
    return dst


def blur(a, k=2):
    """Smooths radar speckle with a 5x5 average (about 250 m)."""
    valid = np.isfinite(a)
    z = np.where(valid, a, 0).astype("float32")
    pz = np.pad(z, k)
    pv = np.pad(valid.astype("float32"), k)
    s = np.zeros_like(z)
    c = np.zeros_like(z)
    for dy in range(2 * k + 1):
        for dx in range(2 * k + 1):
            s += pz[dy:dy + height, dx:dx + width]
            c += pv[dy:dy + height, dx:dx + width]
    out = np.where(c > 0, s / np.maximum(c, 1), np.nan)
    out[~valid] = np.nan
    return out


def lowpass(a, b=BLOCK):
    """Smooth large-scale pattern: median of each b x b block, then smoothly enlarged."""
    h, w = a.shape
    H, Wd = -(-h // b) * b, -(-w // b) * b
    pad = np.full((H, Wd), np.nan, dtype="float32")
    pad[:h, :w] = a
    blocks = pad.reshape(H // b, b, Wd // b, b)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m = np.nanmedian(blocks, axis=(1, 3))
    m = np.where(np.isfinite(m), m, np.nanmedian(a)).astype("float32")
    img = Image.fromarray(m).resize((Wd, H), Image.BILINEAR)
    return np.array(img)[:h, :w]



f_jun = glob.glob("data/NISAR*20260622T*.h5")[0]
f_oct = glob.glob("data/NISAR*20261020T*.h5")[0]

print("\n== Reading NISAR HH")
hh_jun = load_db(f_jun, "HHHH")
hh_oct = load_db(f_oct, "HHHH")
print("== Reading NISAR HV")
hv_jun = load_db(f_jun, "HVHV")
hv_oct = load_db(f_oct, "HVHV")

print("\n== Grey images (%s)" % ("same contrast for both dates" if SAME_CONTRAST else "original look: each picture stretched on its own"))
if SAME_CONTRAST:
    p_hh_jun = p_hh_oct = shared(hh_jun, hh_oct)
    p_hv_jun = p_hv_oct = shared(hv_jun, hv_oct)
else:
    p_hh_jun, p_hh_oct = stretch(hh_jun), stretch(hh_oct)
    p_hv_jun, p_hv_oct = stretch(hv_jun), stretch(hv_oct)
save_grey(hh_jun, f"{OUT}/nisar_20260622_HH.png", p_hh_jun)
save_grey(hh_oct, f"{OUT}/nisar_20261020_HH.png", p_hh_oct)
save_grey(hv_jun, f"{OUT}/nisar_20260622_HV.png", p_hv_jun)
save_grey(hv_oct, f"{OUT}/nisar_20261020_HV.png", p_hv_oct)


print("\n== Change map (broad patterns removed)")
raw_hh = hh_oct - hh_jun
raw_hv = hv_oct - hv_jun
lp_hh = lowpass(raw_hh)
lp_hv = lowpass(raw_hv)
lo_, hi_ = np.nanpercentile(lp_hh[np.isfinite(raw_hh)], (2, 98))
print("   scene-wide HH pattern removed: %.1f to %.1f dB (2nd to 98th percentile)" % (lo_, hi_))
dHH = blur(raw_hh - lp_hh)
dHV = blur(raw_hv - lp_hv)

valid = np.isfinite(dHH) & np.isfinite(dHV)
veg = valid & (dHV >= T_SMALL)
moist = valid & ~veg & (dHH >= T_SMALL)
dark_big = valid & ~veg & ~moist & (dHH <= -T_BIG)
dark_small = valid & ~veg & ~moist & ~dark_big & (dHH <= -T_SMALL)

cls = np.zeros((height, width), dtype="uint8")
cls[dark_big] = 1
cls[dark_small] = 2
cls[moist] = 3
cls[veg] = 4

COLORS = {1: (31, 95, 214), 2: (217, 183, 121), 3: (242, 107, 33), 4: (42, 157, 143)}
rgba = np.zeros((height, width, 4), dtype="uint8")
for k, (r_, g_, b_) in COLORS.items():
    rgba[cls == k] = (r_, g_, b_, 175)
Image.fromarray(rgba).save(f"{OUT}/change_class.png")
print("   saved:", f"{OUT}/change_class.png")

names = ["no meaningful change", "much darker (blue)", "slightly darker (beige)",
         "brighter in HH only (orange)", "brighter in HV (green)"]
total = int(valid.sum())
stats = {"total_km2": int(total * px_km2), "pct": [], "km2": []}
print("\nScene area with data: %d km2" % stats["total_km2"])
for k in range(5):
    n = int((cls[valid] == k).sum())
    stats["pct"].append(round(100 * n / total, 1))
    stats["km2"].append(int(n * px_km2))
    print("  %-30s %5.1f%%   %8d km2" % (names[k], stats["pct"][-1], stats["km2"][-1]))
with open("web/stats.js", "w") as fh:
    fh.write("const STATS = " + json.dumps(stats) + ";\n")
print("   saved: web/stats.js")

print("\nDone.")