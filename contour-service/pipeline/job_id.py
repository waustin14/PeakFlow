from __future__ import annotations

import hashlib
import json
from typing import Any
from shapely.geometry import mapping
from pipeline.geometry import NormalizedGeometry


def canonical_dumps(data: dict[str, Any]) -> str:
    return json.dumps(data, separators=(',', ':'), sort_keys=True, ensure_ascii=True)


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
