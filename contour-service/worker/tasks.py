from __future__ import annotations

from datetime import datetime, timedelta
import json
from sqlalchemy import select
from api.db import SessionLocal
from api.models import ContourJob
from api.settings import get_settings
from pipeline.processing import run_pipeline
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
