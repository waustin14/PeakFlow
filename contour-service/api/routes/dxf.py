from __future__ import annotations

from datetime import datetime, timedelta
import json
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.auth import require_api_key
from api.db import get_db
from api.models import DxfExportJob
from api.rate_limit import check_concurrency_limit, check_rate_limit
from api.schemas.dxf import CreateDxfExportRequest, CreateDxfExportResponse, DxfExportStatusResponse
from api.settings import get_settings
from api.storage import get_store
from pipeline.dem_catalog import selected_signature_components
from pipeline.dem_source import fetch_dem_tiles
from pipeline.geometry import normalize_aoi, buffer_aoi_wgs84
from pipeline.job_id import build_contour_generation_signature, canonical_dumps, compute_job_id
from pipeline.processing import dxf_key
from worker.tasks import process_dxf_export_job

router = APIRouter(prefix='/v1/dxf', tags=['dxf'])


def _status_url(job_id: str) -> str:
    return f"/v1/dxf/exports/{job_id}"


def _download_url(job_id: str) -> str:
    return f"/v1/dxf/exports/{job_id}/download"


@router.post('/exports', response_model=CreateDxfExportResponse)
def create_dxf_export(
    payload: CreateDxfExportRequest,
    api_key: str = Depends(require_api_key),
    db: Session = Depends(get_db),
) -> CreateDxfExportResponse:
    settings = get_settings()

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
    signature = {
        'job_type': 'dxf',
        **build_contour_generation_signature(
            normalized_aoi=normalized,
            interval_ft=payload.interval_ft,
            index_every=payload.index_every,
            buffer_ft=payload.buffer_ft,
            smoothing=payload.smoothing,
            dem_dataset_id=dem_id,
            dem_dataset_version=dem_version,
            algo_version=settings.algo_version,
        ),
    }
    job_id = compute_job_id(signature)
    signature_json = canonical_dumps(signature)

    existing = db.scalar(select(DxfExportJob).where(DxfExportJob.job_id == job_id))
    if existing:
        if existing.status in ('ready', 'queued', 'running'):
            existing.cached_hit = existing.status == 'ready'
            db.add(existing)
            db.commit()
            return CreateDxfExportResponse(
                jobId=job_id,
                status=existing.status,
                statusUrl=_status_url(job_id),
                downloadUrl=_download_url(job_id) if existing.status == 'ready' else None,
            )
        # 'failed' — reset and re-enqueue
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
        task = process_dxf_export_job.delay(job_id)
        existing.worker_task_id = task.id or ''
        db.add(existing)
        db.commit()
        return CreateDxfExportResponse(
            jobId=job_id,
            status='queued',
            statusUrl=_status_url(job_id),
            downloadUrl=None,
        )

    tenant_id = api_key
    if not check_rate_limit(db, tenant_id=tenant_id, per_hour_limit=settings.job_rate_limit_per_hour, model=DxfExportJob):
        raise HTTPException(status_code=429, detail='job create rate limit exceeded')
    if not check_concurrency_limit(db, tenant_id=tenant_id, max_concurrent=settings.max_concurrent_per_tenant, model=DxfExportJob):
        raise HTTPException(status_code=429, detail='too many active jobs')

    now = datetime.utcnow()
    job = DxfExportJob(
        job_id=job_id,
        tenant_id=tenant_id,
        status='queued',
        progress=0,
        request_signature=signature_json,
        request_payload=json.dumps(payload.model_dump(mode='json')),
        dem_dataset_id=dem_id,
        dem_dataset_version=dem_version,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(days=settings.default_ttl_days),
        last_accessed_at=now,
    )
    db.add(job)
    db.commit()

    task = process_dxf_export_job.delay(job_id)
    job.worker_task_id = task.id or ''
    db.add(job)
    db.commit()

    return CreateDxfExportResponse(
        jobId=job_id,
        status='queued',
        statusUrl=_status_url(job_id),
        downloadUrl=None,
    )


@router.get('/exports/{job_id}', response_model=DxfExportStatusResponse)
def get_dxf_export(job_id: str, db: Session = Depends(get_db)) -> DxfExportStatusResponse:
    job = db.scalar(select(DxfExportJob).where(DxfExportJob.job_id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail='job not found')

    return DxfExportStatusResponse(
        jobId=job.job_id,
        status=job.status,
        progress=job.progress,
        createdAt=job.created_at,
        startedAt=job.started_at,
        finishedAt=job.finished_at,
        error=job.error_message or None,
        downloadUrl=_download_url(job.job_id) if job.status == 'ready' else None,
    )


@router.get('/exports/{job_id}/download')
def download_dxf(job_id: str, db: Session = Depends(get_db)) -> Response:
    job = db.scalar(select(DxfExportJob).where(DxfExportJob.job_id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    if job.status != 'ready':
        raise HTTPException(status_code=404, detail='job not ready')

    store = get_store()
    key = job.dxf_s3_key or dxf_key(job_id)
    obj = store.get_bytes(key)

    if obj is None:
        raise HTTPException(status_code=410, detail='DXF file no longer available')

    job.last_accessed_at = datetime.utcnow()
    db.add(job)
    db.commit()

    return Response(
        content=obj.body,
        media_type='application/dxf',
        headers={
            'Content-Disposition': f'attachment; filename="contours_{job_id[:12]}.dxf"',
            'Cache-Control': 'private, max-age=3600',
        },
    )
