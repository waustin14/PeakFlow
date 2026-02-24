"""USGS TNM Access API client — discovers 1/3 arc-second DEM GeoTIFFs by AOI.

Replaces the static DEM catalog with a live query so the pipeline always uses
the most recent available tiles from the National Map.

API docs: https://tnmaccess.nationalmap.gov/api/v1/docs
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request

from pipeline.dem_catalog import DemDataset

TNM_PRODUCTS_URL = 'https://tnmaccess.nationalmap.gov/api/v1/products'
_REQUEST_TIMEOUT_S = 20
_MAX_RETRIES = 3
_RETRY_DELAY_S = 3.0

# Match "USGS 1/3 Arc-Second n40w105 ..." but NOT "USGS 1 Arc Second ..."
_13ARC_RE = re.compile(r'^USGS 1/3 Arc[ -]Second\s+(n\d+w\d+)', re.IGNORECASE)


def _query_tnm(req: urllib.request.Request) -> dict:
    """Issue the TNM request, retrying on transient upstream errors.

    The TNM API depends on ScienceBase as a backend catalog.  When ScienceBase
    is temporarily unreachable, TNM returns a non-JSON body like:
        {errorMessage=[BadRequest] 'HTTPSConnectionPool ... Max retries exceeded'}
    These failures are transient, so we retry with a short delay.
    """
    last_exc: Exception = RuntimeError('TNM API: no attempts made')
    for attempt in range(_MAX_RETRIES):
        if attempt:
            time.sleep(_RETRY_DELAY_S)
        try:
            with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT_S) as resp:
                raw = resp.read()
        except Exception as exc:
            last_exc = RuntimeError(f'TNM Access API request failed: {exc}')
            continue

        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            snippet = raw[:300].decode('utf-8', errors='replace')
            # TNM returns {errorMessage=[BadRequest] '...'} (not valid JSON) when
            # its ScienceBase upstream is unreachable — treat as transient.
            if b'errorMessage' in raw:
                last_exc = RuntimeError(
                    f'TNM Access API upstream error (ScienceBase unreachable). '
                    f'Response: {snippet!r}'
                )
                continue
            # Unexpected non-JSON body — don't retry, surface immediately.
            raise RuntimeError(
                f'TNM Access API returned non-JSON response ({exc}). '
                f'Response preview: {snippet!r}'
            ) from exc

    raise RuntimeError(
        'The USGS National Map tile catalog is temporarily unavailable.'
    ) from last_exc


def fetch_dem_tiles(bbox: tuple[float, float, float, float]) -> list[DemDataset]:
    """Query the TNM Access API for 1/3 arc-second GeoTIFF tiles intersecting *bbox*.

    Args:
        bbox: ``(minX, minY, maxX, maxY)`` in WGS84 decimal degrees.

    Returns:
        One ``DemDataset`` per unique tile (most recent ``publicationDate``
        wins when multiple versions exist), with ``path`` set to a GDAL
        VSICURL string ready for ``gdalbuildvrt``.

    Raises:
        RuntimeError: if the TNM API request fails.
        ValueError: if no 1/3 arc-second tiles intersect the bbox.
    """
    minx, miny, maxx, maxy = bbox
    params = urllib.parse.urlencode({
        'bbox': f'{minx},{miny},{maxx},{maxy}',
        'prodFormats': 'GeoTIFF',
        'max': 50,
        'outputFormat': 'JSON',
    })
    req = urllib.request.Request(
        f'{TNM_PRODUCTS_URL}?{params}',
        headers={'User-Agent': 'PeakFlow-ContourService/1.0'},
    )
    data = _query_tnm(req)

    # Deduplicate: tile_name → (publicationDate, DemDataset)
    # When USGS publishes an updated tile, both the old and new version appear
    # in the response.  We keep the most recent publicationDate.
    best: dict[str, tuple[str, DemDataset]] = {}

    for item in data.get('items', []):
        title = item.get('title', '')
        m = _13ARC_RE.match(title)
        if not m:
            continue  # skip 1 arc-second, 1-meter, S1M, lidar, etc.

        tile_name = m.group(1).lower()
        download_url = item.get('downloadURL', '')
        if not download_url:
            continue

        pub_date = item.get('publicationDate', '0000-00-00')
        bb = item.get('boundingBox', {})
        bounds = (
            float(bb.get('minX', 0.0)),
            float(bb.get('minY', 0.0)),
            float(bb.get('maxX', 0.0)),
            float(bb.get('maxY', 0.0)),
        )
        dataset = DemDataset(
            dataset_id=tile_name,
            version=pub_date,
            path='/vsicurl/' + download_url,
            bounds=bounds,
        )

        if tile_name not in best or pub_date > best[tile_name][0]:
            best[tile_name] = (pub_date, dataset)

    return [ds for _, ds in sorted(best.values(), key=lambda kv: kv[1].dataset_id)]
