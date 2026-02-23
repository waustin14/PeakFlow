from __future__ import annotations

from datetime import datetime, timedelta
from sqlalchemy import select
from api.db import SessionLocal
from api.models import ContourJob
from api.settings import get_settings
from api.storage import get_store


def run_cleanup() -> int:
    settings = get_settings()
    store = get_store()
    now = datetime.utcnow()
    fallback_cutoff = now - timedelta(days=settings.default_ttl_days)

    deleted = 0
    with SessionLocal() as db:
        rows = db.scalars(
            select(ContourJob).where(
                (ContourJob.last_accessed_at <= fallback_cutoff) | (ContourJob.expires_at <= now)
            )
        ).all()

        for job in rows:
            prefix = f"{settings.s3_prefix}/{job.job_id}/"
            store.delete_prefix(prefix)
            db.delete(job)
            deleted += 1

        db.commit()

    return deleted


if __name__ == '__main__':
    count = run_cleanup()
    print(f'deleted_jobs={count}')
