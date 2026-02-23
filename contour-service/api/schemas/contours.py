from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class StyleSettings(BaseModel):
    line_px: int = Field(default=1, ge=1, le=8)
    index_line_px: int = Field(default=2, ge=1, le=12)
    opacity: float = Field(default=0.75, ge=0.0, le=1.0)
    label_index: bool = False


class CreateContourJobRequest(BaseModel):
    aoi: dict[str, Any]
    interval_ft: Literal[2, 5, 10]
    index_every: int = Field(default=5, ge=1, le=20)
    buffer_ft: float = Field(default=300, ge=0.0, le=2000.0)
    min_zoom: int = Field(default=12, ge=0, le=22)
    max_zoom: int = Field(default=17, ge=0, le=22)
    format: Literal['png', 'webp'] = 'png'
    style: StyleSettings = Field(default_factory=StyleSettings)
    smoothing: bool = False

    @model_validator(mode='after')
    def validate_zoom_range(self) -> 'CreateContourJobRequest':
        if self.max_zoom < self.min_zoom:
            raise ValueError('max_zoom must be >= min_zoom')
        if self.max_zoom - self.min_zoom > 8:
            raise ValueError('zoom range too wide; max 8 levels per request')
        return self


class CreateContourJobResponse(BaseModel):
    jobId: str
    status: Literal['queued', 'running', 'ready', 'failed']
    statusUrl: str
    tileTemplateUrl: str


class ContourJobStatusResponse(BaseModel):
    jobId: str
    status: Literal['queued', 'running', 'ready', 'failed']
    progress: int
    createdAt: datetime
    startedAt: datetime | None
    finishedAt: datetime | None
    error: str | None
    minZoom: int
    maxZoom: int
    format: str
