from __future__ import annotations

from datetime import datetime, timedelta
import json
from sqlalchemy import select
from api.db import SessionLocal
from api.models import ContourJob, DxfExportJob
from api.settings import get_settings
from api.storage import get_store
from pipeline.dxf_export import geojson_to_dxf
from pipeline.geometry import normalize_aoi
from pipeline.job_id import build_contour_generation_signature, compute_job_id
from pipeline.processing import generate_contours, geojson_key, dxf_key, run_pipeline
from worker.celery_app import celery_app


@celery_app.task(name='contours.process_job')
def process_contour_job(job_id: str) -> None:
    settings = get_settings()
    with SessionLocal() as db:
        job = db.scalar(select(ContourJob).where(ContourJob.job_id == job_id))
        if not job:
            return
        if job.status == 'ready':
            return

        job.status = 'running'
        job.progress = 5
        job.started_at = datetime.utcnow()
        db.add(job)
        db.commit()

        def _update_progress(pct: int) -> None:
            job.progress = pct
            db.add(job)
            db.commit()

        try:
            payload = json.loads(job.request_payload)
            result = run_pipeline(job_id=job.job_id, payload=payload, progress_cb=_update_progress)

            job.status = 'ready'
            job.progress = 100
            job.finished_at = datetime.utcnow()
            job.error_message = ''
            job.projected_crs = result.projected_crs
            job.bounds_wgs84 = json.dumps(result.bounds)
            job.expires_at = datetime.utcnow() + timedelta(days=settings.default_ttl_days)
        except Exception as exc:
            job.status = 'failed'
            job.progress = 100
            job.finished_at = datetime.utcnow()
            job.error_message = str(exc)
        finally:
            db.add(job)
            db.commit()


@celery_app.task(name='contours.process_dxf_export')
def process_dxf_export_job(job_id: str) -> None:
    settings = get_settings()
    store = get_store()

    with SessionLocal() as db:
        job = db.scalar(select(DxfExportJob).where(DxfExportJob.job_id == job_id))
        if not job:
            return
        if job.status == 'ready':
            return

        job.status = 'running'
        job.progress = 5
        job.started_at = datetime.utcnow()
        db.add(job)
        db.commit()

        def _update_progress(pct: int) -> None:
            job.progress = pct
            db.add(job)
            db.commit()

        try:
            payload = json.loads(job.request_payload)

            # Compute the contour generation signature to find cached GeoJSON.
            # Use stored DEM identifiers from the DB (set at job creation time)
            # to avoid an unnecessary USGS TNM API call when GeoJSON is cached.
            normalized = normalize_aoi(payload['aoi'])
            gen_signature = build_contour_generation_signature(
                normalized_aoi=normalized,
                interval_ft=int(payload['interval_ft']),
                index_every=int(payload['index_every']),
                buffer_ft=float(payload['buffer_ft']),
                smoothing=bool(payload.get('smoothing', False)),
                dem_dataset_id=job.dem_dataset_id,
                dem_dataset_version=job.dem_dataset_version,
                algo_version=settings.algo_version,
            )
            gen_job_id = compute_job_id(gen_signature)
            cached_key = geojson_key(gen_job_id)

            _update_progress(10)

            # Try to use cached GeoJSON from a prior job
            cached = store.get_bytes(cached_key)
            if cached is not None:
                geojson_bytes = cached.body
                _update_progress(70)
            else:
                # No cached GeoJSON — run contour generation from scratch
                gen_result = generate_contours(
                    generation_job_id=gen_job_id,
                    payload=payload,
                    progress_cb=_update_progress,
                )
                obj = store.get_bytes(gen_result.geojson_s3_key)
                if obj is None:
                    raise RuntimeError('Failed to retrieve generated contour GeoJSON from storage')
                geojson_bytes = obj.body
                job.projected_crs = gen_result.projected_crs
                job.bounds_wgs84 = json.dumps(gen_result.bounds)

            _update_progress(75)

            # Convert GeoJSON to DXF
            dxf_bytes = geojson_to_dxf(geojson_bytes)
            _update_progress(90)

            # Upload DXF to S3
            s3_key = dxf_key(job_id)
            store.put_bytes(s3_key, dxf_bytes, 'application/dxf')

            job.status = 'ready'
            job.progress = 100
            job.finished_at = datetime.utcnow()
            job.error_message = ''
            job.dxf_s3_key = s3_key
            job.source_geojson_key = cached_key
            job.expires_at = datetime.utcnow() + timedelta(days=settings.default_ttl_days)
        except Exception as exc:
            job.status = 'failed'
            job.progress = 100
            job.finished_at = datetime.utcnow()
            job.error_message = str(exc)
        finally:
            db.add(job)
            db.commit()
