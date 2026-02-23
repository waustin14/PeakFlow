from __future__ import annotations

import math
from dataclasses import dataclass
from shapely.geometry import Polygon, MultiPolygon, shape, mapping
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient
from shapely.ops import transform
from shapely.validation import make_valid
from pyproj import CRS, Transformer

FEET_TO_METERS = 0.3048
SQM_TO_SQMI = 3.861021585e-7


@dataclass(frozen=True)
class NormalizedGeometry:
    geometry: BaseGeometry
    projected_crs: str
    area_sqmi: float


def utm_crs_for_lonlat(lon: float, lat: float) -> CRS:
    zone = int(math.floor((lon + 180.0) / 6.0) + 1)
    epsg = 32600 + zone if lat >= 0 else 32700 + zone
    return CRS.from_epsg(epsg)


def _project(geom: BaseGeometry, src: CRS, dst: CRS) -> BaseGeometry:
    transformer = Transformer.from_crs(src, dst, always_xy=True)
    return transform(transformer.transform, geom)


def _round_coords(geom: BaseGeometry, digits: int = 6) -> BaseGeometry:
    def _rounder(x: float, y: float, z: float | None = None):
        if z is None:
            return round(x, digits), round(y, digits)
        return round(x, digits), round(y, digits), round(z, digits)

    return transform(_rounder, geom)


def _normalize_polygon_orientation(geom: BaseGeometry) -> BaseGeometry:
    if isinstance(geom, Polygon):
        return orient(geom, sign=1.0)
    if isinstance(geom, MultiPolygon):
        return MultiPolygon([orient(g, sign=1.0) for g in geom.geoms])
    return geom


def normalize_aoi(geojson: dict, simplify_m: float = 0.5) -> NormalizedGeometry:
    geom = shape(geojson)
    if geom.is_empty:
        raise ValueError('AOI is empty')
    if not geom.is_valid:
        geom = make_valid(geom)
    if geom.geom_type not in {'Polygon', 'MultiPolygon'}:
        raise ValueError('AOI must be Polygon or MultiPolygon')

    centroid = geom.centroid
    src_crs = CRS.from_epsg(4326)
    utm = utm_crs_for_lonlat(centroid.x, centroid.y)

    projected = _project(geom, src_crs, utm)
    if not projected.is_valid:
        projected = projected.buffer(0)
    simplified = projected.simplify(simplify_m, preserve_topology=True)
    area_sqmi = float(simplified.area * SQM_TO_SQMI)

    back = _project(simplified, utm, src_crs)
    normalized = _normalize_polygon_orientation(back)
    rounded = _round_coords(normalized, digits=6)

    return NormalizedGeometry(geometry=rounded, projected_crs=utm.to_string(), area_sqmi=area_sqmi)


def buffer_aoi_wgs84(geom_wgs84: BaseGeometry, buffer_ft: float) -> BaseGeometry:
    if buffer_ft <= 0:
        return geom_wgs84
    centroid = geom_wgs84.centroid
    src_crs = CRS.from_epsg(4326)
    utm = utm_crs_for_lonlat(centroid.x, centroid.y)
    projected = _project(geom_wgs84, src_crs, utm)
    buffered = projected.buffer(buffer_ft * FEET_TO_METERS)
    return _project(buffered, utm, src_crs)


def geojson_from_geometry(geom: BaseGeometry) -> dict:
    return mapping(geom)
