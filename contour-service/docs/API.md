# API

Base URL: `http://localhost:8080`

Auth header for create-job endpoint:

- `x-api-key: <key>`

## POST /v1/contours/jobs

Creates or reuses a deterministic contour job.

```bash
curl -X POST http://localhost:8080/v1/contours/jobs \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev-key' \
  -d @fixtures/request.json
```

## GET /v1/contours/jobs/{jobId}

Poll job state.

```bash
curl http://localhost:8080/v1/contours/jobs/<jobId>
```

## GET /v1/contours/tiles/{jobId}/{z}/{x}/{y}.png

Tile endpoint for map overlays.

```bash
curl -o tile.png http://localhost:8080/v1/contours/tiles/<jobId>/14/2620/6332.png
```
