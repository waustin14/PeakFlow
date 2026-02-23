from __future__ import annotations

import io
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import mercantile
from PIL import Image, ImageDraw
import json
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry


TILE_SIZE = 256


@dataclass(frozen=True)
class RenderStyle:
    line_px: int
    index_line_px: int
    opacity: float



def lonlat_to_tile_pixel(lon: float, lat: float, z: int, x: int, y: int) -> tuple[float, float]:
    n = 2.0 ** z
    x_global = (lon + 180.0) / 360.0 * n * TILE_SIZE
    lat_rad = math.radians(max(min(lat, 85.05112878), -85.05112878))
    y_global = (1.0 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2.0 * n * TILE_SIZE
    return x_global - (x * TILE_SIZE), y_global - (y * TILE_SIZE)


def _iter_line_coords(geom: BaseGeometry) -> Iterable[list[tuple[float, float]]]:
    gt = geom.geom_type
    if gt == 'LineString':
        yield [(float(x), float(y)) for x, y in geom.coords]
    elif gt == 'MultiLineString':
        for line in geom.geoms:
            yield [(float(x), float(y)) for x, y in line.coords]


def render_tile_from_geojson(
    contour_geojson_path: str,
    z: int,
    x: int,
    y: int,
    style: RenderStyle,
    out_format: str,
) -> bytes:
    image = Image.new('RGBA', (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    data = json.loads(Path(contour_geojson_path).read_text())
    alpha = int(max(0, min(style.opacity, 1.0)) * 255)

    for feat in data.get('features', []):
        geom = shape(feat['geometry'])
        is_index = bool(feat.get('properties', {}).get('is_index', False))
        width = style.index_line_px if is_index else style.line_px
        color = (40, 40, 40, alpha)

        for line in _iter_line_coords(geom):
            if len(line) < 2:
                continue
            points = [lonlat_to_tile_pixel(lon, lat, z, x, y) for lon, lat in line]
            draw.line(points, fill=color, width=width, joint='curve')

    buf = io.BytesIO()
    fmt = out_format.upper()
    if fmt == 'WEBP':
        image.save(buf, format='WEBP', lossless=True)
    else:
        image.save(buf, format='PNG')
    return buf.getvalue()


def transparent_tile_bytes(out_format: str) -> bytes:
    img = Image.new('RGBA', (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
    out = io.BytesIO()
    if out_format.lower() == 'webp':
        img.save(out, format='WEBP', lossless=True)
    else:
        img.save(out, format='PNG')
    return out.getvalue()


def tiles_covering_geometry(geom_wgs84: BaseGeometry, z: int) -> list[mercantile.Tile]:
    west, south, east, north = geom_wgs84.bounds
    return list(mercantile.tiles(west, south, east, north, [z]))
