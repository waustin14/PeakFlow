from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from api.models import ContourJob


def check_rate_limit(db: Session, tenant_id: str, per_hour_limit: int, model: Any = ContourJob) -> bool:
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    stmt = select(func.count()).select_from(model).where(
        model.tenant_id == tenant_id,
        model.created_at >= one_hour_ago,
    )
    count = db.scalar(stmt) or 0
    return count < per_hour_limit


def check_concurrency_limit(db: Session, tenant_id: str, max_concurrent: int, model: Any = ContourJob) -> bool:
    stmt = select(func.count()).select_from(model).where(
        model.tenant_id == tenant_id,
        model.status.in_(['queued', 'running']),
    )
    running = db.scalar(stmt) or 0
    return running < max_concurrent
