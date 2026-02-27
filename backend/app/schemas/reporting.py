from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.hardening import ReportStatus


class ReportCreateRequest(BaseModel):
    format: str = Field(default="pdf", pattern="^(pdf|slides)$")
    template: str = Field(default="executive_summary", max_length=64)
    include_sections: list[str] = Field(default_factory=lambda: ["overview", "themes", "recommendations", "personas"])


class ReportJobAccepted(BaseModel):
    report_id: UUID
    status: ReportStatus
    accepted_at: datetime


class ReportAssetOut(BaseModel):
    asset_id: UUID
    file_name: str
    mime_type: str
    expires_at: datetime
    download_token: str


class ReportJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_id: UUID
    status: ReportStatus
    format: str
    template: str
    include_sections: list
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    error: str | None = None
    asset: ReportAssetOut | None = None


class ReportJobList(BaseModel):
    items: list[ReportJobOut]
    count: int


class DownloadAssetResponse(BaseModel):
    asset_id: UUID
    file_name: str
    mime_type: str
    expires_at: datetime
    download_path: str


class TrackEventRequest(BaseModel):
    event_name: str
    payload: dict | None = None
    workspace_id: UUID | None = None

