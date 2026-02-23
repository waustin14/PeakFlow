# contour-service

Dynamic LiDAR contour generation service for Google Maps tile overlays.

## Quick Start

```bash
cd contour-service
cp .env.example .env
make up
```

API will be available at `http://localhost:8080`.

## Layout

- `api/` FastAPI HTTP service
- `worker/` Celery task worker
- `pipeline/` Deterministic contour and tile generation pipeline
- `infra/` Docker Compose, Dockerfile, bootstrap assets
- `docs/` API and deployment docs
- `fixtures/` local development AOIs and DEM catalog fixture
- `demo/` minimal Google Maps overlay HTML example
- `tests/` pytest suite
