"""Generate a DEM catalog covering the entire United States using USGS 3DEP
1 arc-second (~30 m) Cloud-Optimized GeoTIFFs streamed via GDAL VSICURL.

No data is downloaded; the catalog just records the bounding box and VSICURL
path for each 1°×1° tile.  The worker fetches only the pixels it needs at
processing time.

USGS tile naming convention (NW corner):
  n{lat:02d}w{lon:03d}  →  covers [lat-1, lat] × [-(lon+1), -lon]
  e.g. n38w123 → lat [37, 38], lon [-123, -122]

Run:
  python scripts/gen_catalog_usgs.py [--out fixtures/dem_catalog_national.json]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

BASE_URL = (
    "https://prd-tnm.s3.amazonaws.com"
    "/StagedProducts/Elevation/1/TIFF/current"
    "/{name}/USGS_1_{name}.tif"
)
VSICURL_PREFIX = "/vsicurl/"
DATASET_VERSION = "2024"


def _tile(lat: int, lon: int) -> dict:
    """Return a catalog entry for the tile whose NW corner is (lat, -lon)."""
    name = f"n{lat:02d}w{lon:03d}"
    return {
        "id": f"usgs-3dep-1arc-{name}",
        "version": DATASET_VERSION,
        "path": VSICURL_PREFIX + BASE_URL.format(name=name),
        # bounds: [minLon, minLat, maxLon, maxLat]
        "bounds": [-(lon + 1), lat - 1, -lon, lat],
    }


def generate_tiles() -> list[dict]:
    tiles: list[dict] = []

    # ── Contiguous United States ───────────────────────────────────────────
    # NW corners: lat 25–50 (rows 24–49 of data), lon 66–125
    for lat in range(25, 51):
        for lon in range(66, 126):
            tiles.append(_tile(lat, lon))

    # ── Hawaii ─────────────────────────────────────────────────────────────
    for lat in range(19, 24):
        for lon in range(155, 162):
            tiles.append(_tile(lat, lon))

    # ── Alaska ─────────────────────────────────────────────────────────────
    # 1 arc-second coverage: roughly n55–n72, w130–w180
    for lat in range(55, 73):
        for lon in range(130, 181):
            tiles.append(_tile(lat, lon))

    # ── Puerto Rico / U.S. Virgin Islands ─────────────────────────────────
    for lat in range(18, 20):
        for lon in range(65, 68):
            tiles.append(_tile(lat, lon))

    return tiles


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default=str(Path(__file__).parent.parent / "fixtures" / "dem_catalog_national.json"),
        help="Output path for the catalog JSON",
    )
    args = parser.parse_args()

    tiles = generate_tiles()
    catalog = {"datasets": tiles}

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(catalog, indent=2))
    print(f"Wrote {len(tiles)} tile entries to {out_path}")


if __name__ == "__main__":
    main()
