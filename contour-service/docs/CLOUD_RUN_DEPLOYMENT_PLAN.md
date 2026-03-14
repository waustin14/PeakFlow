# Cloud Run Deployment Plan for `contour-service` (GCP)

## Summary
Deploy `contour-service` to GCP using:
- Cloud Run service for public API
- Cloud Run service for internal job runner
- Cloud Tasks for async job dispatch (replacing Celery/Redis)
- Cloud SQL for PostgreSQL
- Cloud Storage + Cloud CDN for tiles/metadata
- Secret Manager for credentials/env secrets

This plan keeps external API behavior stable while replacing queue/worker internals with GCP-native components optimized for low current usage and future scale.

## Target Architecture
1. `contour-api` (Cloud Run, public HTTPS)
- Serves existing endpoints:
  - `POST /v1/contours/jobs`
  - `GET /v1/contours/jobs/{jobId}`
  - `GET /v1/contours/tiles/{jobId}/{z}/{x}/{y}.{fmt}` (initially retained)
- Writes job rows to Cloud SQL.
- Enqueues Cloud Task to call internal worker endpoint.

2. `contour-worker` (Cloud Run, private/internal ingress)
- New internal endpoint receives task payload `{ job_id }`.
- Runs `run_pipeline(...)`.
- Updates job state/progress in Cloud SQL.
- Writes tiles + metadata to Cloud Storage bucket.

3. Managed services
- Cloud SQL Postgres (single instance, zonal HA optional later)
- Cloud Tasks queue (HTTP target -> `contour-worker`)
- Cloud Storage bucket `contours-*` (replaces MinIO)
- Cloud CDN in front of bucket for tile delivery (phase 2 optimization)
- Secret Manager for DB URL, API keys, and service config

## Repo-Level Changes (planned)
1. Queueing and worker execution
- Replace `process_contour_job.delay(job_id)` in:
  - `/Users/will/Documents/Projects/PeakFlow/contour-service/api/routes/contours.py`
- Add Cloud Tasks client module:
  - `/Users/will/Documents/Projects/PeakFlow/contour-service/api/tasks.py` (new)
- Add internal worker HTTP handler:
  - `/Users/will/Documents/Projects/PeakFlow/contour-service/api/routes/internal_tasks.py` (new)
- Keep `worker/tasks.py` temporarily for fallback during rollout, then remove in cleanup phase.

2. Storage backend
- Keep S3 API usage via `boto3`, but point to GCS S3-compatible endpoint initially for minimal code churn, then migrate to native GCS SDK in phase 3 if needed.
- Update settings for cloud endpoint/secure mode in:
  - `/Users/will/Documents/Projects/PeakFlow/contour-service/api/settings.py`

3. Runtime and startup
- Remove Celery/Redis mandatory config from startup path.
- Add worker auth validation (shared secret header) for Cloud Tasks -> worker endpoint.

4. Ops docs
- Replace Docker Compose-centric deployment doc with Cloud Run runbook in:
  - `/Users/will/Documents/Projects/PeakFlow/contour-service/docs/DEPLOYMENT.md`

## Public API / Interface Changes
1. External API
- No breaking changes to existing `/v1/contours/*` contract.

2. New internal interface
- `POST /internal/tasks/process-job`
- Request body: `{ "job_id": "<string>" }`
- Required auth header from Cloud Tasks: `X-Contour-Task-Secret: <secret>`
- Response:
  - `200` job completed or no-op (already ready/not found)
  - `500` transient failure (Cloud Tasks retries)
  - `4xx` permanent failure only for malformed/unauthorized requests

3. Environment variable changes
- Add:
  - `CONTOUR_TASKS_QUEUE`
  - `CONTOUR_TASKS_LOCATION`
  - `CONTOUR_TASKS_PROJECT`
  - `CONTOUR_TASKS_WORKER_URL`
  - `CONTOUR_TASKS_SECRET`
- Deprecate:
  - `CONTOUR_BROKER_URL`
  - `CONTOUR_RESULT_BACKEND`

## Deployment Steps (Cloud Console Manual)
1. GCP project bootstrap
- Enable APIs: Cloud Run, Cloud Build, Artifact Registry, Cloud SQL Admin, Cloud Tasks, Secret Manager, Cloud Storage, Cloud CDN.
- Create service accounts:
  - `contour-api-sa`
  - `contour-worker-sa`
- Grant least-privilege IAM roles for SQL client, Tasks enqueuer (API), Storage object admin (worker), Secret accessor.

2. Data services
- Create Cloud SQL Postgres instance + DB/user.
- Configure private or public connectivity (start with public + authorized Cloud Run connectorless path for speed; tighten later).
- Run DB migrations/startup schema creation once.

3. Storage
- Create GCS bucket for contours.
- Configure lifecycle rule for TTL-based deletion aligned with `default_ttl_days`.
- Add CDN later once tile URL path is switched to bucket host.

4. Build and publish container image
- Build current Dockerfile with Cloud Build.
- Push to Artifact Registry repo.

5. Deploy `contour-worker`
- Cloud Run service, internal ingress only.
- CPU/memory baseline: `2 vCPU / 4 GiB`, timeout `900s`, concurrency `1`.
- Max instances: low cap initially (for cost control), e.g. `2-3`.
- Set secrets/env vars.
- Add task secret header validation.

6. Create Cloud Tasks queue
- Configure retry policy:
  - max attempts: 5
  - exponential backoff starting 10s, max 300s
- Configure dispatch rate conservatively for low scale (e.g., 1-2 concurrent dispatches).

7. Deploy `contour-api`
- Cloud Run public HTTPS.
- Min instances `0`, max instances modest cap (e.g., 3), concurrency `40-80`.
- Update job creation endpoint to enqueue Cloud Task instead of Celery task.

8. Validate end-to-end
- Submit contour request.
- Confirm job transitions `queued -> running -> ready`.
- Confirm tile fetch returns expected image.

9. Observability and alerts
- Create logs-based metrics for:
  - task failures
  - worker runtime > 600s
  - job failure ratio
- Alerting policies to email/Slack.

10. Hardening (post-launch)
- Add Cloud Armor policy for API.
- Rotate secrets in Secret Manager.
- Optional: move tile serving to GCS+CDN URL and stop proxying tiles through API for lower cost.

## Reliability and Scalability Design
1. Reliability
- At-least-once task execution via Cloud Tasks retries.
- Idempotent processing preserved using existing deterministic `job_id` and status checks.
- Worker ingress internal-only + shared secret auth.
- Cloud SQL managed backups enabled.

2. Scalability path
- Increase worker max instances and queue dispatch rate without API redesign.
- Split heavy jobs by zoom band in future if p95 runtime approaches timeout.
- Move tile reads fully to CDN/bucket to decouple read traffic from API.

3. Cost controls (low usage first)
- API min instances `0`.
- Worker min instances `0`, concurrency `1`.
- Conservative instance caps and queue rate.
- Lifecycle delete on tile objects.

## Testing and Acceptance Criteria
1. Unit tests
- Queue client:
  - enqueue request payload correctness
  - auth header inclusion
- Worker handler:
  - valid/invalid secret handling
  - idempotent job states (`ready`, missing job) behavior

2. Integration tests
- Job submission creates DB row + enqueues task.
- Worker processes queued job to completion.
- Failure path sets `status=failed` and captures error message.
- Retry path: transient worker failure retried by Cloud Tasks then succeeds.

3. Smoke tests (deployed)
- `GET /healthz` for both services.
- Submit known fixture AOI and retrieve expected tile.
- Verify cleanup job behavior against expired records.

4. Performance gates
- p95 worker runtime < 6 minutes for standard AOIs.
- API p95 < 500ms for create/status endpoints (excluding tile fetch).

## Rollout Plan
1. Phase 1 (parallel readiness)
- Deploy Cloud Run services and managed dependencies in staging.
- Keep existing local/docker flow untouched.

2. Phase 2 (production cutover)
- Route production traffic to `contour-api` Cloud Run URL.
- Enable Cloud Tasks queue and worker service.
- Monitor error rates and runtime.

3. Phase 3 (optimization)
- Shift tile delivery from API proxy endpoint to GCS+CDN URL template in API response.
- Remove Celery/Redis dependencies from code and docs.

4. Rollback
- If Cloud Tasks/worker issues occur, fallback to prior containerized worker queue path (temporary dual-path retained during first release window).
- Keep old env variables/code path for one release cycle, then remove.

## Assumptions and Defaults Chosen
1. Queue model: Cloud Tasks + internal worker endpoint.
2. Database: Cloud SQL Postgres.
3. API exposure: Public HTTPS with existing API key model.
4. Provisioning: Cloud Console manual setup (not Terraform), as requested.
5. Region: single low-latency US region (default `us-central1`) for lowest-cost tier behavior.
6. Initial scale: low traffic, cost-optimized (`min instances = 0` for both services).
