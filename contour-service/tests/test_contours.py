from __future__ import annotations

import json
import os
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault('CONTOUR_API_KEYS', 'dev-key')
os.environ.setdefault('CONTOUR_DB_URL', 'sqlite:///./test_contour.db')
os.environ.setdefault('CONTOUR_BROKER_URL', 'redis://localhost:6379/0')
os.environ.setdefault('CONTOUR_RESULT_BACKEND', 'redis://localhost:6379/1')
os.environ.setdefault('CONTOUR_S3_ENDPOINT', 'http://localhost:9000')
os.environ.setdefault('CONTOUR_S3_REGION', 'us-east-1')
os.environ.setdefault('CONTOUR_S3_ACCESS_KEY', 'minio')
os.environ.setdefault('CONTOUR_S3_SECRET_KEY', 'minio123')
os.environ.setdefault('CONTOUR_S3_BUCKET', 'contours')
os.environ.setdefault('CONTOUR_S3_SECURE', 'false')
os.environ.setdefault('CONTOUR_S3_PREFIX', 'contours')
os.environ.setdefault('CONTOUR_DEM_CATALOG', str(Path(__file__).resolve().parents[1] / 'fixtures' / 'dem_catalog.json'))
os.environ.setdefault('CONTOUR_DEM_ROOT', str(Path(__file__).resolve().parents[1] / 'fixtures' / 'dem'))
os.environ.setdefault('CONTOUR_TMP_ROOT', '/tmp/contour-tests')
os.environ.setdefault('CONTOUR_MAX_AOI_SQMI', '5')
os.environ.setdefault('CONTOUR_DEFAULT_TTL_DAYS', '30')
os.environ.setdefault('CONTOUR_ALGO_VERSION', 'v1')
os.environ.setdefault('CONTOUR_JOB_RATE_LIMIT_PER_HOUR', '100')
os.environ.setdefault('CONTOUR_MAX_CONCURRENT_PER_TENANT', '10')
os.environ.setdefault('CONTOUR_MAX_ZOOM', '18')

from api.db import Base, get_db
from api.main import app
from api.models import ContourJob
from api.routes import contours as contour_routes
from pipeline.geometry import normalize_aoi
from pipeline.job_id import build_signature, compute_job_id


TEST_DB = Path('test_contour.db')
if TEST_DB.exists():
    TEST_DB.unlink()

engine = create_engine('sqlite:///./test_contour.db', future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def override_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def _request_payload() -> dict:
    return {
        'aoi': {
            'type': 'Polygon',
            'coordinates': [[
                [-122.442041, 37.767996],
                [-122.435933, 37.767996],
                [-122.435933, 37.772595],
                [-122.442041, 37.772595],
                [-122.442041, 37.767996],
            ]],
        },
        'interval_ft': 5,
        'index_every': 5,
        'buffer_ft': 300,
        'min_zoom': 12,
        'max_zoom': 14,
        'format': 'png',
        'style': {'line_px': 1, 'index_line_px': 2, 'opacity': 0.75, 'label_index': False},
        'smoothing': False,
    }


def test_deterministic_job_id() -> None:
    payload = _request_payload()
    norm = normalize_aoi(payload['aoi'])

    sig = build_signature(
        normalized_aoi=norm,
        interval_ft=payload['interval_ft'],
        index_every=payload['index_every'],
        buffer_ft=payload['buffer_ft'],
        min_zoom=payload['min_zoom'],
        max_zoom=payload['max_zoom'],
        style=payload['style'],
        dem_dataset_id='sf-demo-dem',
        dem_dataset_version='2026.02',
        algo_version='v1',
        tile_format='png',
        smoothing=False,
    )

    assert compute_job_id(sig) == compute_job_id(sig)


def test_geometry_normalization_equivalent_order() -> None:
    payload_a = _request_payload()
    payload_b = _request_payload()
    coords = payload_b['aoi']['coordinates'][0][:-1]
    payload_b['aoi']['coordinates'][0] = list(reversed(coords)) + [list(reversed(coords))[0]]

    norm_a = normalize_aoi(payload_a['aoi'])
    norm_b = normalize_aoi(payload_b['aoi'])

    sig_a = build_signature(norm_a, 5, 5, 300, 12, 14, payload_a['style'], 'sf-demo-dem', '2026.02', 'v1', 'png', False)
    sig_b = build_signature(norm_b, 5, 5, 300, 12, 14, payload_b['style'], 'sf-demo-dem', '2026.02', 'v1', 'png', False)

    assert compute_job_id(sig_a) == compute_job_id(sig_b)


def test_job_caching_existing_job(monkeypatch) -> None:
    calls = {'count': 0}

    class FakeTask:
        id = 'task-1'

    def fake_delay(job_id: str):
        calls['count'] += 1
        return FakeTask()

    monkeypatch.setattr(contour_routes.process_contour_job, 'delay', fake_delay)

    payload = _request_payload()
    r1 = client.post('/v1/contours/jobs', json=payload, headers={'x-api-key': 'dev-key'})
    assert r1.status_code == 200
    r2 = client.post('/v1/contours/jobs', json=payload, headers={'x-api-key': 'dev-key'})
    assert r2.status_code == 200

    assert r1.json()['jobId'] == r2.json()['jobId']
    assert calls['count'] == 1


def test_tile_existence_known_tile() -> None:
    class FakeObj:
        def __init__(self, body: bytes, content_type: str):
            self.body = body
            self.content_type = content_type

    class FakeStore:
        def get_bytes(self, key: str):
            return FakeObj(b'\x89PNG\r\n\x1a\n', 'image/png')

    contour_routes.get_store = lambda: FakeStore()

    with TestingSessionLocal() as db:
        job = ContourJob(
            job_id='tile-job',
            tenant_id='dev-key',
            status='ready',
            progress=100,
            request_signature='{}',
            request_payload='{}',
            dem_dataset_id='sf-demo-dem',
            dem_dataset_version='2026.02',
            min_zoom=12,
            max_zoom=14,
            tile_format='png',
        )
        db.add(job)
        db.commit()

    response = client.get('/v1/contours/tiles/tile-job/12/654/1583.png')
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('image/png')


def test_limits_too_large_aoi_rejected(monkeypatch) -> None:
    payload = _request_payload()
    payload['aoi'] = {
        'type': 'Polygon',
        'coordinates': [[
            [-123.5, 36.8],
            [-121.5, 36.8],
            [-121.5, 38.8],
            [-123.5, 38.8],
            [-123.5, 36.8],
        ]],
    }

    response = client.post('/v1/contours/jobs', json=payload, headers={'x-api-key': 'dev-key'})
    assert response.status_code == 400
