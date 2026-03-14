from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class CreateDxfExportRequest(BaseModel):
    aoi: dict[str, Any]
    interval_ft: Literal[2, 5, 10]
    index_every: int = Field(default=5, ge=1, le=20)
    buffer_ft: float = Field(default=300, ge=0.0, le=2000.0)
    smoothing: bool = False


class CreateDxfExportResponse(BaseModel):
    jobId: str
    status: Literal['queued', 'running', 'ready', 'failed']
    statusUrl: str
    downloadUrl: str | None


class DxfExportStatusResponse(BaseModel):
    jobId: str
    status: Literal['queued', 'running', 'ready', 'failed']
    progress: int
    createdAt: datetime
    startedAt: datetime | None
    finishedAt: datetime | None
    error: str | None
    downloadUrl: str | None
