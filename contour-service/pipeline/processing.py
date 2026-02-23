from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from typing import Any, Callable
from shapely.geometry import shape
from shapely.ops import unary_union, transform
from pyproj import CRS, Transformer
from api.settings import get_settings
from api.storage import get_store
from pipeline.dem_catalog import DemDataset, resolve_dem_path
from pipeline.dem_source import fetch_dem_tiles
from pipeline.geometry import buffer_aoi_wgs84, normalize_aoi
from pipeline.render import RenderStyle, render_tile_from_geojson, tiles_covering_geometry


@dataclass
class PipelineResult:
    projected_crs: str
    bounds: tuple[float, float, float, float]
    datasets: list[DemDataset]
    tile_count: int


def _run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"{cmd[0]} failed (exit {result.returncode}):\n{result.stderr.strip()}"
        )


def _assert_valid_pixels(raster_path: Path) -> None:
    """Raise if the raster contains no valid (non-NoData) pixels.

    This catches the case where gdalwarp fetches a VSICURL tile that doesn't
    exist or covers only NoData (water, missing coverage) and exits 0 anyway.
    """
    result = subprocess.run(
        ['gdalinfo', '-approx_stats', '-json', str(raster_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f'gdalinfo failed on {raster_path.name}:\n{result.stderr.strip()}')
    import json as _json
    info = _json.loads(result.stdout)
    bands = info.get('bands', [])
    if not bands or 'minimum' not in bands[0]:
        raise ValueError(
            'No valid elevation data found for this AOI. '
            'The area may not have USGS 3DEP coverage, or the DEM tile is missing. '
            'Try a different location or check https://apps.nationalmap.gov/3depdem/.'
        )


def _ensure_projected_geojson(contour_geojson_path: str, projected_crs: str, out_wgs84_geojson_path: str) -> None:
    _run([
        'ogr2ogr',
        '-f', 'GeoJSON',
        '-t_srs', 'EPSG:4326',
        out_wgs84_geojson_path,
        contour_geojson_path,
    ])


def _tile_key(job_id: str, z: int, x: int, y: int, ext: str) -> str:
    settings = get_settings()
    return f"{settings.s3_prefix}/{job_id}/{z}/{x}/{y}.{ext}"


def _metadata_key(job_id: str) -> str:
    settings = get_settings()
    return f"{settings.s3_prefix}/{job_id}/metadata.json"


def run_pipeline(
    job_id: str,
    payload: dict[str, Any],
    progress_cb: Callable[[int], None] | None = None,
) -> PipelineResult:
    def _report(pct: int) -> None:
        if progress_cb is not None:
            progress_cb(pct)

    settings = get_settings()
    store = get_store()
    Path(settings.tmp_root).mkdir(parents=True, exist_ok=True)

    # 1) Validate + limit AOI
    normalized = normalize_aoi(payload['aoi'])
    if normalized.area_sqmi > settings.max_aoi_sqmi:
        raise ValueError(f"AOI exceeds limit of {settings.max_aoi_sqmi} sq mi")

    aoi_geom = normalized.geometry

    # 2) Compute buffered AOI
    buffered = buffer_aoi_wgs84(aoi_geom, float(payload['buffer_ft']))

    # 3) Discover DEM tiles via USGS TNM Access API
    selected = fetch_dem_tiles(buffered.bounds)
    if not selected:
        raise ValueError('No USGS 3DEP 1/3 arc-second tiles found for this AOI')

    _report(10)

    with TemporaryDirectory(dir=settings.tmp_root) as td:
        td_path = Path(td)
        vrt = td_path / 'dem.vrt'
        clipped = td_path / 'dem_clip.tif'
        projected = td_path / 'dem_projected.tif'
        feet = td_path / 'dem_feet.tif'
        contours = td_path / 'contours.geojson'
        contours_wgs84 = td_path / 'contours_wgs84.geojson'

        dem_paths = [resolve_dem_path(settings.dem_root, d.path) for d in selected]
        _run(['gdalbuildvrt', str(vrt), *dem_paths])

        minx, miny, maxx, maxy = buffered.bounds
        _run([
            'gdalwarp',
            '-te', str(minx), str(miny), str(maxx), str(maxy),
            '-t_srs', 'EPSG:4326',
            str(vrt),
            str(clipped),
        ])
        _assert_valid_pixels(clipped)
        _report(25)

        # 4) Reproject DEM to projected CRS
        _run([
            'gdalwarp',
            '-t_srs', normalized.projected_crs,
            str(clipped),
            str(projected),
        ])
        _report(38)

        # 5) Convert elevation units to feet
        _run([
            'gdal_calc.py',
            '-A', str(projected),
            '--calc=A*3.28084',
            '--NoDataValue=-9999',
            '--outfile', str(feet),
            '--overwrite',
        ])
        _report(48)

        # 6) Optional smoothing (deterministic placeholder, no-op when false)
        if payload.get('smoothing', False):
            smoothed = td_path / 'dem_feet_smoothed.tif'
            _run([
                'gdalwarp',
                '-r', 'bilinear',
                str(feet),
                str(smoothed),
            ])
            feet = smoothed
            _report(53)

        # 7) Generate contours
        interval = int(payload['interval_ft'])
        _run([
            'gdal_contour',
            '-a', 'elev_ft',
            '-i', str(interval),
            str(feet),
            str(contours),
        ])
        _report(62)

        # add is_index field and normalize integer elevation
        _mark_index_contours(contours, interval=interval, index_every=int(payload['index_every']))

        # reproject contours for web mercator tile rendering math
        _ensure_projected_geojson(str(contours), normalized.projected_crs, str(contours_wgs84))
        _report(66)

        # 8) Tile generation approach (raster overlay)
        style = payload['style']
        render_style = RenderStyle(
            line_px=int(style['line_px']),
            index_line_px=int(style['index_line_px']),
            opacity=float(style['opacity']),
        )

        # Pre-collect all tiles so we can report proportional progress
        all_tiles = []
        for z in range(int(payload['min_zoom']), int(payload['max_zoom']) + 1):
            all_tiles.extend(tiles_covering_geometry(aoi_geom, z))
        total_tiles = len(all_tiles)

        _TILE_START = 66
        _TILE_END = 95

        tile_count = 0
        last_reported_pct = _TILE_START
        fmt = payload['format']
        for tile in all_tiles:
            img = render_tile_from_geojson(str(contours_wgs84), z=tile.z, x=tile.x, y=tile.y, style=render_style, out_format=fmt)
            store.put_bytes(_tile_key(job_id, tile.z, tile.x, tile.y, fmt), img, _content_type(fmt))
            tile_count += 1
            if total_tiles > 0:
                pct = _TILE_START + int((tile_count / total_tiles) * (_TILE_END - _TILE_START))
                if pct > last_reported_pct:
                    _report(pct)
                    last_reported_pct = pct

        # 9) Finalize metadata
        _report(98)
        metadata = {
            'job_id': job_id,
            'dem_datasets': [{'id': d.dataset_id, 'version': d.version, 'path': d.path} for d in selected],
            'projected_crs': normalized.projected_crs,
            'bounds_wgs84': aoi_geom.bounds,
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'ttl_days': settings.default_ttl_days,
            'expires_at': (datetime.utcnow() + timedelta(days=settings.default_ttl_days)).isoformat() + 'Z',
            'tile_count': tile_count,
        }
        store.put_bytes(_metadata_key(job_id), json.dumps(metadata).encode('utf-8'), 'application/json')

    return PipelineResult(
        projected_crs=normalized.projected_crs,
        bounds=aoi_geom.bounds,
        datasets=selected,
        tile_count=tile_count,
    )


def _mark_index_contours(contours_geojson_path: Path, interval: int, index_every: int) -> None:
    raw = json.loads(contours_geojson_path.read_text())
    step = interval * index_every
    for feat in raw.get('features', []):
        props = feat.setdefault('properties', {})
        elev = int(round(float(props.get('elev_ft', 0))))
        props['elev_ft'] = elev
        props['is_index'] = (elev % step == 0)
    contours_geojson_path.write_text(json.dumps(raw))


def _content_type(fmt: str) -> str:
    if fmt == 'webp':
        return 'image/webp'
    return 'image/png'
