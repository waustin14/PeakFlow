# Contour Service — Cloud Run Deployment

## Architecture

```
Cloudflare Worker  ──►  /contour-api/* proxy
                           │
                           ▼
Cloud Run (API)    ──►  FastAPI  (public ingress, scales to zero)
Cloud Run (worker) ──►  Celery   (no ingress, min-instances 1)
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
               Neon      Upstash   Cloudflare R2
             (Postgres)  (Redis)   (tile storage)
```

The API and worker share a single Docker image built from `infra/Dockerfile`.
DEM data is streamed on demand from USGS S3 via GDAL's `/vsicurl/` driver —
no DEM files need to be bundled or pre-downloaded.

---

## Prerequisites

- GCP project with billing enabled
- `gcloud` CLI authenticated (`gcloud auth login`)
- Docker installed locally
- Accounts on [Neon](https://neon.tech), [Upstash](https://upstash.com), and [Cloudflare](https://dash.cloudflare.com) (R2)

---

## Step 1 — External services

### Neon (Postgres)

1. Create a new Neon project named `peakflow-contour`
2. Copy the connection string — it will look like:
   `postgresql+psycopg://user:pass@ep-xxx.us-east-2.aws.neon.tech/contour?sslmode=require`
3. Note as `CONTOUR_DB_URL`

The app creates its own tables on startup (`Base.metadata.create_all`) — no migration step needed.

### Upstash (Redis)

1. Create a new Upstash Redis database (global region, free tier)
2. Copy the `rediss://` connection URL
3. Use it for both `CONTOUR_BROKER_URL` and `CONTOUR_RESULT_BACKEND` (different DB indices):
   - `CONTOUR_BROKER_URL=rediss://:pass@global-xxx.upstash.io:6379/0`
   - `CONTOUR_RESULT_BACKEND=rediss://:pass@global-xxx.upstash.io:6379/1`

### Cloudflare R2

1. Create a bucket named `peakflow-contours`
2. Go to **R2 → Manage R2 API Tokens → Create API Token** with Object Read & Write on this bucket
3. Note the Access Key ID, Secret Access Key, and your account ID
4. S3-compatible endpoint: `https://<account-id>.r2.cloudflarestorage.com`

---

## Step 2 — Enable GCP APIs and create Artifact Registry

```bash
gcloud config set project <your-project-id>

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com

gcloud artifacts repositories create peakflow \
  --repository-format=docker \
  --location=us-central1
```

---

## Step 3 — Build and push the image

```bash
cd contour-service

IMAGE=us-central1-docker.pkg.dev/<project-id>/peakflow/contour-service:latest

gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f infra/Dockerfile -t $IMAGE .
docker push $IMAGE
```

---

## Step 4 — Deploy the API service

```bash
gcloud run deploy contour-api \
  --image $IMAGE \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 4 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "
CONTOUR_API_KEYS=<your-api-key>,\
CONTOUR_DB_URL=<neon-connection-string>,\
CONTOUR_BROKER_URL=<upstash-broker-url>,\
CONTOUR_RESULT_BACKEND=<upstash-result-url>,\
CONTOUR_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com,\
CONTOUR_S3_REGION=auto,\
CONTOUR_S3_ACCESS_KEY=<r2-access-key>,\
CONTOUR_S3_SECRET_KEY=<r2-secret-key>,\
CONTOUR_S3_BUCKET=peakflow-contours,\
CONTOUR_S3_SECURE=true,\
CONTOUR_S3_PREFIX=contours,\
CONTOUR_DEM_CATALOG=/app/fixtures/dem_catalog_national.json,\
CONTOUR_DEM_ROOT=/app/fixtures/dem,\
CONTOUR_TMP_ROOT=/tmp/contour,\
CONTOUR_MAX_AOI_SQMI=5,\
CONTOUR_DEFAULT_TTL_DAYS=30,\
CONTOUR_JOB_RATE_LIMIT_PER_HOUR=30,\
CONTOUR_MAX_CONCURRENT_PER_TENANT=2
"
```

Note the deployed service URL — you'll need it for the worker and Cloudflare proxy.

---

## Step 5 — Deploy the worker service

The worker uses the same image but a different entrypoint. It needs no public ingress.

```bash
gcloud run deploy contour-worker \
  --image $IMAGE \
  --region us-central1 \
  --platform managed \
  --no-allow-unauthenticated \
  --ingress internal \
  --min-instances 1 \
  --max-instances 2 \
  --memory 2Gi \
  --cpu 2 \
  --command "/app/worker/entrypoint.sh" \
  --set-env-vars "
CONTOUR_API_KEYS=<your-api-key>,\
CONTOUR_DB_URL=<neon-connection-string>,\
CONTOUR_BROKER_URL=<upstash-broker-url>,\
CONTOUR_RESULT_BACKEND=<upstash-result-url>,\
CONTOUR_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com,\
CONTOUR_S3_REGION=auto,\
CONTOUR_S3_ACCESS_KEY=<r2-access-key>,\
CONTOUR_S3_SECRET_KEY=<r2-secret-key>,\
CONTOUR_S3_BUCKET=peakflow-contours,\
CONTOUR_S3_SECURE=true,\
CONTOUR_S3_PREFIX=contours,\
CONTOUR_DEM_CATALOG=/app/fixtures/dem_catalog_national.json,\
CONTOUR_DEM_ROOT=/app/fixtures/dem,\
CONTOUR_TMP_ROOT=/tmp/contour,\
CONTOUR_MAX_AOI_SQMI=5,\
CONTOUR_DEFAULT_TTL_DAYS=30,\
CPL_VSIL_CURL_CACHE_SIZE=200000000,\
GDAL_HTTP_MULTIPLEX=YES,\
GDAL_HTTP_VERSION=2,\
GDAL_HTTP_MAX_RETRY=3,\
GDAL_HTTP_RETRY_DELAY=2,\
GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
"
```

> **Note on cost:** `--min-instances 1` keeps the worker warm so jobs are picked up
> immediately. At 2 GB RAM it consumes ~720k GB-seconds/month, slightly over the
> 360k free tier. Expect ~$3–8/mo for the worker. Set `--min-instances 0` for $0
> but accept a ~20s cold start on the first job after idle.

---

## Step 6 — Cleanup cron (Cloud Scheduler)

Create a Cloud Run Job for the cleanup script:

```bash
gcloud run jobs create contour-cleanup \
  --image $IMAGE \
  --region us-central1 \
  --command "python" \
  --args "-m,scripts.cleanup_expired" \
  --set-env-vars "
CONTOUR_DB_URL=<neon-connection-string>,\
CONTOUR_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com,\
CONTOUR_S3_REGION=auto,\
CONTOUR_S3_ACCESS_KEY=<r2-access-key>,\
CONTOUR_S3_SECRET_KEY=<r2-secret-key>,\
CONTOUR_S3_BUCKET=peakflow-contours,\
CONTOUR_S3_SECURE=true,\
CONTOUR_S3_PREFIX=contours,\
CONTOUR_DEFAULT_TTL_DAYS=30
"

# Schedule it to run daily at 3 AM UTC
gcloud scheduler jobs create http contour-cleanup-schedule \
  --location us-central1 \
  --schedule "0 3 * * *" \
  --uri "https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/<project-id>/jobs/contour-cleanup:run" \
  --http-method POST \
  --oauth-service-account-email <project-number>-compute@developer.gserviceaccount.com
```

---

## Step 7 — Wire up the Cloudflare proxy Worker

Update the contour proxy Worker in the Cloudflare dashboard with the API service URL:

```js
const CONTOUR_SERVICE_URL = 'https://contour-api-<hash>-uc.a.run.app'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.hostname = new URL(CONTOUR_SERVICE_URL).hostname
    url.protocol = 'https:'
    url.port = ''
    url.pathname = url.pathname.replace(/^\/contour-api/, '')

    return fetch(new Request(url.toString(), request))
  },
}
```

Bind it to the Pages project at route `/contour-api/*`.

---

## Step 8 — Smoke test

```bash
# Health check
curl https://peakflow.austinnet.work/contour-api/healthz

# Submit a contour job (replace with a real watershed polygon)
curl -X POST https://peakflow.austinnet.work/contour-api/v1/contours/jobs \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-api-key>" \
  -d @contour-service/fixtures/request.json

# Poll status
curl https://peakflow.austinnet.work/contour-api/v1/contours/jobs/<job-id>
```

---

## Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `CONTOUR_API_KEYS` | Comma-separated valid API keys | `key1,key2` |
| `CONTOUR_DB_URL` | Neon Postgres connection string | `postgresql+psycopg://...` |
| `CONTOUR_BROKER_URL` | Upstash Redis broker URL | `rediss://:pass@...6379/0` |
| `CONTOUR_RESULT_BACKEND` | Upstash Redis result URL | `rediss://:pass@...6379/1` |
| `CONTOUR_S3_ENDPOINT` | R2 S3-compatible endpoint | `https://<id>.r2.cloudflarestorage.com` |
| `CONTOUR_S3_REGION` | R2 region | `auto` |
| `CONTOUR_S3_ACCESS_KEY` | R2 API token access key | |
| `CONTOUR_S3_SECRET_KEY` | R2 API token secret key | |
| `CONTOUR_S3_BUCKET` | R2 bucket name | `peakflow-contours` |
| `CONTOUR_S3_SECURE` | Use HTTPS for S3 | `true` |
| `CONTOUR_S3_PREFIX` | Key prefix inside bucket | `contours` |
| `CONTOUR_DEM_CATALOG` | Path to DEM catalog JSON | `/app/fixtures/dem_catalog_national.json` |
| `CONTOUR_DEM_ROOT` | Local DEM fallback dir | `/app/fixtures/dem` |
| `CONTOUR_TMP_ROOT` | Temp working dir | `/tmp/contour` |
| `CONTOUR_MAX_AOI_SQMI` | Max area of interest size | `5.0` |
| `CONTOUR_DEFAULT_TTL_DAYS` | Job artifact retention | `30` |
| `CONTOUR_JOB_RATE_LIMIT_PER_HOUR` | Rate limit per API key | `30` |
| `CONTOUR_MAX_CONCURRENT_PER_TENANT` | Max parallel jobs per key | `2` |

Worker-only GDAL tuning vars (stream performance from USGS S3):

| Variable | Value |
|---|---|
| `CPL_VSIL_CURL_CACHE_SIZE` | `200000000` |
| `GDAL_HTTP_MULTIPLEX` | `YES` |
| `GDAL_HTTP_VERSION` | `2` |
| `GDAL_HTTP_MAX_RETRY` | `3` |
| `GDAL_HTTP_RETRY_DELAY` | `2` |
| `GDAL_DISABLE_READDIR_ON_OPEN` | `EMPTY_DIR` |

---

## Deployment Checklist

- [ ] Create Neon project, note `CONTOUR_DB_URL`
- [ ] Create Upstash Redis database, note broker and result URLs
- [ ] Create Cloudflare R2 bucket, generate API token, note credentials
- [ ] Enable Cloud Run, Artifact Registry, and Cloud Scheduler APIs
- [ ] Create Artifact Registry repository
- [ ] Build and push Docker image
- [ ] Deploy `contour-api` Cloud Run service (public ingress)
- [ ] Deploy `contour-worker` Cloud Run service (internal, min 1)
- [ ] Create `contour-cleanup` Cloud Run Job + Cloud Scheduler trigger
- [ ] Update Cloudflare proxy Worker with Cloud Run service URL
- [ ] Bind Worker to Pages project at `/contour-api/*`
- [ ] Run smoke tests (healthz, job submit, job poll)

---

## Estimated Cost

| Service | Free tier | Est. cost |
|---|---|---|
| Cloud Run API | 2M req/mo, 360k GB-s | $0 |
| Cloud Run Worker | min-instances 1 @ 2GB | ~$3–8/mo |
| Cloud Run Cleanup Job | negligible | $0 |
| Cloud Scheduler | 3 jobs free | $0 |
| Neon Postgres | 0.5 GB | $0 |
| Upstash Redis | 10k cmds/day | $0 |
| Cloudflare R2 | 10 GB, no egress fees | $0 |
| **Total** | | **~$3–8/mo** |
