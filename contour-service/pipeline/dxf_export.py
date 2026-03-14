"""Convert projected contour GeoJSON to an AutoCAD-compatible DXF file.

Each GeoJSON LineString feature becomes a 3D polyline with:
- XY coordinates in UTM meters (from the projected GeoJSON)
- Z coordinate set to the feature's ``elev_ft`` value (feet)

The output is suitable for import into AutoCAD, SketchUp, or similar CAD tools
to generate 3D terrain meshes from continuous contour lines.
"""
from __future__ import annotations

import json
from io import StringIO

import ezdxf


def geojson_to_dxf(geojson_bytes: bytes) -> bytes:
    """Convert a projected contour GeoJSON to DXF bytes.

    Args:
        geojson_bytes: UTF-8 encoded GeoJSON FeatureCollection where each
            feature is a LineString with ``elev_ft`` and ``is_index`` properties.
            Coordinates must be in a projected CRS (e.g. UTM meters).

    Returns:
        Binary DXF file content (R2010 format).

    Raises:
        ValueError: If the GeoJSON contains no contour features.
    """
    fc = json.loads(geojson_bytes)
    features = fc.get('features', [])
    if not features:
        raise ValueError('No contour features in GeoJSON')

    doc = ezdxf.new('R2010')
    doc.header['$INSUNITS'] = 6  # meters

    doc.layers.add('CONTOURS', color=7)  # white/black depending on background
    doc.layers.add('CONTOURS_INDEX', color=7)

    msp = doc.modelspace()
    polyline_count = 0

    for feature in features:
        geom = feature.get('geometry', {})
        if geom.get('type') != 'LineString':
            continue

        coords = geom.get('coordinates', [])
        if len(coords) < 2:
            continue

        props = feature.get('properties', {})
        elev_ft = float(props.get('elev_ft', 0))
        is_index = bool(props.get('is_index', False))
        layer = 'CONTOURS_INDEX' if is_index else 'CONTOURS'

        # Build 3D vertices: (easting_m, northing_m, elevation_ft)
        # Each contour line is continuous and flat at its prescribed elevation.
        points = [(c[0], c[1], elev_ft) for c in coords]
        msp.add_polyline3d(points, dxfattribs={'layer': layer})
        polyline_count += 1

    if polyline_count == 0:
        raise ValueError('No valid LineString contour features found in GeoJSON')

    buf = StringIO()
    doc.write(buf)
    return buf.getvalue().encode('utf-8')
