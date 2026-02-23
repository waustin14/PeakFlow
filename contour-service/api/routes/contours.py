from __future__ import annotations

from datetime import datetime, timedelta
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.auth import require_api_key
from api.db import get_db
from api.models import ContourJob
from api.rate_limit import check_concurrency_limit, check_rate_limit
from api.schemas.contours import CreateContourJobRequest, CreateContourJobResponse, ContourJobStatusResponse
from api.settings import get_settings
from api.storage import get_store
from pipeline.dem_catalog import selected_signature_components
from pipeline.dem_source import fetch_dem_tiles
from pipeline.geometry import normalize_aoi, buffer_aoi_wgs84
from pipeline.job_id import build_signature, canonical_dumps, compute_job_id
from pipeline.render import transparent_tile_bytes
from worker.tasks import process_contour_job

router = APIRouter(prefix='/v1/contours', tags=['contours'])


def _tile_template(request: Request, job_id: str, fmt: str) -> str:
    base = str(request.base_url).rstrip('/')
    return f"{base}/v1/contours/tiles/{job_id}/{{z}}/{{x}}/{{y}}.{fmt}"


def _metadata_status_url(job_id: str) -> str:
    return f"/v1/contours/jobs/{job_id}"


def _tile_key(job_id: str, z: int, x: int, y: int, ext: str) -> str:
    settings = get_settings()
    return f"{settings.s3_prefix}/{job_id}/{z}/{x}/{y}.{ext}"


@router.post('/jobs', response_model=CreateContourJobResponse)
def create_job(
    payload: CreateContourJobRequest,
    request: Request,
    api_key: str = Depends(require_api_key),
    db: Session = Depends(get_db),
) -> CreateContourJobResponse:
    settings = get_settings()

    if payload.max_zoom > settings.max_zoom:
        raise HTTPException(status_code=400, detail=f'max_zoom must be <= {settings.max_zoom}')

    normalized = normalize_aoi(payload.aoi)
    if normalized.area_sqmi > settings.max_aoi_sqmi:
        raise HTTPException(status_code=400, detail=f'AOI exceeds max area of {settings.max_aoi_sqmi} sq mi')

    buffered = buffer_aoi_wgs84(normalized.geometry, payload.buffer_ft)
    try:
        selected = fetch_dem_tiles(buffered.bounds)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if not selected:
        raise HTTPException(
            status_code=400,
            detail='No USGS 3DEP 1/3 arc-second tiles found for this AOI. '
                   'Verify coverage at https://apps.nationalmap.gov/3depdem/',
        )

    dem_id, dem_version = selected_signature_components(selected)
    signature = build_signature(
        normalized_aoi=normalized,
        interval_ft=payload.interval_ft,
        index_every=payload.index_every,
        buffer_ft=payload.buffer_ft,
        min_zoom=payload.min_zoom,
        max_zoom=payload.max_zoom,
        style=payload.style.model_dump(mode='json'),
        dem_dataset_id=dem_id,
        dem_dataset_version=dem_version,
        algo_version=settings.algo_version,
        tile_format=payload.format,
        smoothing=payload.smoothing,
    )
    job_id = compute_job_id(signature)
    signature_json = canonical_dumps(signature)

    existing = db.scalar(select(ContourJob).where(ContourJob.job_id == job_id))
    if existing:
        # Return cached result for ready/in-progress jobs; re-queue failed ones.
        if existing.status in ('ready', 'queued', 'running'):
            existing.cached_hit = existing.status == 'ready'
            db.add(existing)
            db.commit()
            return CreateContourJobResponse(
                jobId=job_id,
                status=existing.status,
                statusUrl=_metadata_status_url(job_id),
                tileTemplateUrl=_tile_template(request, job_id, payload.format),
            )
        # 'failed' — reset and re-enqueue so the user can retry
        now = datetime.utcnow()
        existing.status = 'queued'
        existing.progress = 0
        existing.error_message = ''
        existing.started_at = None
        existing.finished_at = None
        existing.cached_hit = False
        existing.updated_at = now
        db.add(existing)
        db.commit()
        task = process_contour_job.delay(job_id)
        existing.worker_task_id = task.id or ''
        db.add(existing)
        db.commit()
        return CreateContourJobResponse(
            jobId=job_id,
            status='queued',
            statusUrl=_metadata_status_url(job_id),
            tileTemplateUrl=_tile_template(request, job_id, payload.format),
        )

    tenant_id = api_key
    if not check_rate_limit(db, tenant_id=tenant_id, per_hour_limit=settings.job_rate_limit_per_hour):
        raise HTTPException(status_code=429, detail='job create rate limit exceeded')
    if not check_concurrency_limit(db, tenant_id=tenant_id, max_concurrent=settings.max_concurrent_per_tenant):
        raise HTTPException(status_code=429, detail='too many active jobs')

    now = datetime.utcnow()
    job = ContourJob(
        job_id=job_id,
        tenant_id=tenant_id,
        status='queued',
        progress=0,
        request_signature=signature_json,
        request_payload=json.dumps(payload.model_dump(mode='json')),
        dem_dataset_id=dem_id,
        dem_dataset_version=dem_version,
        min_zoom=payload.min_zoom,
        max_zoom=payload.max_zoom,
        tile_format=payload.format,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(days=settings.default_ttl_days),
        last_accessed_at=now,
    )
    db.add(job)
    db.commit()

    task = process_contour_job.delay(job_id)
    job.worker_task_id = task.id or ''
    db.add(job)
    db.commit()

    return CreateContourJobResponse(
        jobId=job_id,
        status='queued',
        statusUrl=_metadata_status_url(job_id),
        tileTemplateUrl=_tile_template(request, job_id, payload.format),
    )


@router.get('/jobs/{job_id}', response_model=ContourJobStatusResponse)
def get_job(job_id: str, db: Session = Depends(get_db)) -> ContourJobStatusResponse:
    job = db.scalar(select(ContourJob).where(ContourJob.job_id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail='job not found')

    return ContourJobStatusResponse(
        jobId=job.job_id,
        status=job.status,
        progress=job.progress,
        createdAt=job.created_at,
        startedAt=job.started_at,
        finishedAt=job.finished_at,
        error=job.error_message or None,
        minZoom=job.min_zoom,
        maxZoom=job.max_zoom,
        format=job.tile_format,
    )


@router.get('/tiles/{job_id}/{z}/{x}/{y}.{fmt}')
def get_tile(job_id: str, z: int, x: int, y: int, fmt: str, db: Session = Depends(get_db)) -> Response:
    if fmt not in {'png', 'webp'}:
        raise HTTPException(status_code=404, detail='unsupported format')

    job = db.scalar(select(ContourJob).where(ContourJob.job_id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    if job.status != 'ready':
        raise HTTPException(status_code=404, detail='job not ready')

    store = get_store()
    key = _tile_key(job_id, z, x, y, fmt)
    obj = store.get_bytes(key)

    job.last_accessed_at = datetime.utcnow()
    db.add(job)
    db.commit()

    if obj is None:
        body = transparent_tile_bytes(fmt)
        return Response(
            content=body,
            media_type='image/webp' if fmt == 'webp' else 'image/png',
            headers={'Cache-Control': 'public, max-age=31536000, immutable'},
        )

    return Response(
        content=obj.body,
        media_type=obj.content_type,
        headers={'Cache-Control': 'public, max-age=31536000, immutable'},
    )
