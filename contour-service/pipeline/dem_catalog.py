from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from shapely.geometry import box, shape
from shapely.geometry.base import BaseGeometry


@dataclass(frozen=True)
class DemDataset:
    dataset_id: str
    version: str
    path: str
    bounds: tuple[float, float, float, float]


def load_catalog(path: str) -> list[DemDataset]:
    raw = json.loads(Path(path).read_text())
    datasets: list[DemDataset] = []
    for d in raw.get('datasets', []):
        datasets.append(
            DemDataset(
                dataset_id=d['id'],
                version=d['version'],
                path=d['path'],
                bounds=tuple(d['bounds']),
            )
        )
    return datasets


def select_datasets(catalog: list[DemDataset], geom_wgs84: BaseGeometry) -> list[DemDataset]:
    selected: list[DemDataset] = []
    for dem in catalog:
        if geom_wgs84.intersects(box(*dem.bounds)):
            selected.append(dem)
    selected.sort(key=lambda d: (d.dataset_id, d.version))
    return selected


def resolve_dem_path(dem_root: str, path: str) -> str:
    """Return the GDAL-openable path for a catalog entry.

    Remote sources (VSICURL, VSIS3, bare https://) are returned as-is.
    Relative paths are joined to *dem_root*.  Absolute local paths pass through.
    """
    if path.startswith('/vsi') or path.startswith('http') or Path(path).is_absolute():
        return path
    return str((Path(dem_root) / path).resolve())


def selected_signature_components(selected: list[DemDataset]) -> tuple[str, str]:
    if not selected:
        return 'none', 'none'
    ids = ','.join(d.dataset_id for d in selected)
    versions = ','.join(d.version for d in selected)
    return ids, versions
