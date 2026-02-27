from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_workspace_role
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.hardening import ExportAsset, ReportJob, ReportStatus
from app.models.project import Project
from app.models.survey import Survey
from app.models.user import User
from app.models.workspace import WorkspaceRole
from app.schemas.reporting import (
    DownloadAssetResponse,
    ReportAssetOut,
    ReportCreateRequest,
    ReportJobAccepted,
    ReportJobList,
    ReportJobOut,
    TrackEventRequest,
)
from app.services.events import log_audit_event, log_usage_event
from app.services.reporting import generate_report_job

router = APIRouter()


def _get_survey_and_workspace(db: Session, survey_id: UUID) -> tuple[Survey, UUID]:
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    project = db.get(Project, survey.project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return survey, project.workspace_id


def _job_out(db: Session, job: ReportJob) -> ReportJobOut:
    asset = db.scalar(select(ExportAsset).where(ExportAsset.report_job_id == job.id))
    asset_out = None
    if asset:
        asset_out = ReportAssetOut(
            asset_id=asset.id,
            file_name=asset.file_name,
            mime_type=asset.mime_type,
            expires_at=asset.expires_at,
            download_token=asset.download_token,
        )
    return ReportJobOut(
        id=job.id,
        survey_id=job.survey_id,
        status=job.status,
        format=job.format,
        template=job.template,
        include_sections=job.include_sections,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        error=job.error,
        asset=asset_out,
    )


@router.post("/surveys/{survey_id}/reports", response_model=ReportJobAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_report(
    survey_id: UUID,
    payload: ReportCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportJobAccepted:
    survey, workspace_id = _get_survey_and_workspace(db, survey_id)
    require_workspace_role(db, user, workspace_id, WorkspaceRole.editor)
    job = ReportJob(
        survey_id=survey.id,
        created_by=user.id,
        status=ReportStatus.queued,
        format=payload.format,
        template=payload.template,
        include_sections=payload.include_sections,
    )
    db.add(job)
    db.flush()
    log_audit_event(
        db,
        action="report.create",
        entity_type="report_job",
        entity_id=str(job.id),
        actor_user_id=user.id,
        workspace_id=workspace_id,
        metadata={"survey_id": str(survey_id), "format": payload.format},
    )
    log_usage_event(
        db,
        event_name="report.created",
        user_id=user.id,
        workspace_id=workspace_id,
        payload={"survey_id": str(survey_id), "format": payload.format},
    )
    db.commit()
    db.refresh(job)
    background_tasks.add_task(generate_report_job, job.id)
    return ReportJobAccepted(report_id=job.id, status=job.status, accepted_at=job.created_at)


@router.get("/surveys/{survey_id}/reports", response_model=ReportJobList)
def list_reports(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportJobList:
    _, workspace_id = _get_survey_and_workspace(db, survey_id)
    require_workspace_role(db, user, workspace_id, WorkspaceRole.viewer)
    rows = db.scalars(select(ReportJob).where(ReportJob.survey_id == survey_id).order_by(ReportJob.created_at.desc())).all()
    return ReportJobList(items=[_job_out(db, row) for row in rows], count=len(rows))


@router.get("/surveys/{survey_id}/reports/{report_id}", response_model=ReportJobOut)
def report_detail(
    survey_id: UUID,
    report_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportJobOut:
    _, workspace_id = _get_survey_and_workspace(db, survey_id)
    require_workspace_role(db, user, workspace_id, WorkspaceRole.viewer)
    row = db.scalar(select(ReportJob).where(ReportJob.id == report_id, ReportJob.survey_id == survey_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report job not found")
    return _job_out(db, row)


@router.get("/exports/{asset_id}/download")
def download_export(
    asset_id: UUID,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    asset = db.get(ExportAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if asset.download_token != token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid download token")
    expires_at = asset.expires_at if asset.expires_at.tzinfo else asset.expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Download link expired")

    file_path = Path(asset.storage_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset file missing")
    return FileResponse(path=str(file_path), filename=asset.file_name, media_type=asset.mime_type)


@router.post("/events/track", status_code=status.HTTP_202_ACCEPTED)
def track_event(
    payload: TrackEventRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    log_usage_event(
        db,
        event_name=payload.event_name,
        user_id=user.id,
        workspace_id=payload.workspace_id,
        payload=payload.payload,
    )
    db.commit()
    return {"status": "accepted"}
