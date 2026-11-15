import glob, h5py, rasterio

for f in glob.glob("data/NISAR*"):
    print("\n==", f)
    with h5py.File(f) as h:
        def show(name, obj):
            if isinstance(obj, h5py.Dataset) and "frequencyA" in name:
                print(name, obj.shape)
        h.visititems(show)

for f in glob.glob("data/s1a*"):
    with rasterio.open(f) as r:
        print("\n==", f)
        print(r.shape, r.crs, r.bounds, "GCP:", len(r.gcps[0]))