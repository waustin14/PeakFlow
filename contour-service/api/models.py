from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from api.db import Base


class ContourJob(Base):
    __tablename__ = 'contour_jobs'
    __table_args__ = (UniqueConstraint('job_id', name='uq_job_id'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    request_signature: Mapped[str] = mapped_column(Text, nullable=False)
    request_payload: Mapped[str] = mapped_column(Text, nullable=False)

    dem_dataset_id: Mapped[str] = mapped_column(String(128), nullable=False)
    dem_dataset_version: Mapped[str] = mapped_column(String(64), nullable=False)
    projected_crs: Mapped[str] = mapped_column(String(64), default='')
    bounds_wgs84: Mapped[str] = mapped_column(Text, default='')

    min_zoom: Mapped[int] = mapped_column(Integer, nullable=False)
    max_zoom: Mapped[int] = mapped_column(Integer, nullable=False)
    tile_format: Mapped[str] = mapped_column(String(8), default='png', nullable=False)

    error_message: Mapped[str] = mapped_column(Text, default='')
    worker_task_id: Mapped[str] = mapped_column(String(128), default='')

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cached_hit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
