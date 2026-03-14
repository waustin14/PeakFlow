from __future__ import annotations

import hashlib
import json
from typing import Any
from shapely.geometry import mapping
from pipeline.geometry import NormalizedGeometry


def canonical_dumps(data: dict[str, Any]) -> str:
    return json.dumps(data, separators=(',', ':'), sort_keys=True, ensure_ascii=True)


def build_contour_generation_signature(
    normalized_aoi: NormalizedGeometry,
    interval_ft: int,
    index_every: int,
    buffer_ft: float,
    smoothing: bool,
    dem_dataset_id: str,
    dem_dataset_version: str,
    algo_version: str,
) -> dict[str, Any]:
    """Signature covering only contour generation parameters (no render/tile params).

    Used to derive the S3 key for persisted GeoJSON so that both tile jobs and
    DXF export jobs can share the same cached contour data.
    """
    return {
        'algo': algo_version,
        'aoi': mapping(normalized_aoi.geometry),
        'buffer_ft': round(float(buffer_ft), 3),
        'dem_dataset': {
            'id': dem_dataset_id,
            'version': dem_dataset_version,
        },
        'index_every': int(index_every),
        'interval_ft': int(interval_ft),
        'projected_crs': normalized_aoi.projected_crs,
        'smoothing': bool(smoothing),
    }


def build_signature(
    normalized_aoi: NormalizedGeometry,
    interval_ft: int,
    index_every: int,
    buffer_ft: float,
    min_zoom: int,
    max_zoom: int,
    style: dict[str, Any],
    dem_dataset_id: str,
    dem_dataset_version: str,
    algo_version: str,
    tile_format: str,
    smoothing: bool,
) -> dict[str, Any]:
    # NOTE: The tile job signature must preserve the original key layout for
    # backwards compatibility with existing cached job IDs.  In the original
    # structure, ``smoothing`` lives inside ``render``, not at the top level.
    return {
        'algo': algo_version,
        'aoi': mapping(normalized_aoi.geometry),
        'buffer_ft': round(float(buffer_ft), 3),
        'dem_dataset': {
            'id': dem_dataset_id,
            'version': dem_dataset_version,
        },
        'index_every': int(index_every),
        'interval_ft': int(interval_ft),
        'max_zoom': int(max_zoom),
        'min_zoom': int(min_zoom),
        'projected_crs': normalized_aoi.projected_crs,
        'render': {
            'format': tile_format,
            'smoothing': bool(smoothing),
            'style': style,
        },
    }


def compute_job_id(signature: dict[str, Any]) -> str:
    canonical = canonical_dumps(signature)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
