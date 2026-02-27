from datetime import UTC, datetime, timedelta
from pathlib import Path
import secrets
from uuid import UUID

from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.feedback import InsightSummary
from app.models.hardening import ExportAsset, ReportJob, ReportStatus
from app.models.survey import Survey


def _exports_dir() -> Path:
    path = Path(settings.REPORT_EXPORT_DIR)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def generate_report_job(report_id: UUID) -> None:
    db = SessionLocal()
    try:
        report = db.get(ReportJob, report_id)
        if not report:
            return

        report.status = ReportStatus.running
        db.add(report)
        db.commit()

        survey = db.get(Survey, report.survey_id)
        latest = db.scalar(
            select(InsightSummary).where(InsightSummary.survey_id == report.survey_id).order_by(InsightSummary.generated_at.desc())
        )
        if not survey:
            raise RuntimeError("Survey not found")

        sections = report.include_sections or []
        content_lines = [
            f"Report for survey: {survey.title}",
            f"Generated at: {datetime.now(UTC).isoformat()}",
            f"Format: {report.format}",
            "",
        ]
        if latest:
            if "overview" in sections:
                content_lines.extend(["Overview:", latest.overview, ""])
            if "themes" in sections:
                content_lines.extend(["Themes included."])
            if "recommendations" in sections:
                content_lines.extend(["Recommendations included."])
        else:
            content_lines.extend(["No insights available yet."])

        file_ext = "pdf" if report.format == "pdf" else "txt"
        file_name = f"report_{report.id}.{file_ext}"
        path = _exports_dir() / file_name
        path.write_text("\n".join(content_lines), encoding="utf-8")

        asset = ExportAsset(
            survey_id=report.survey_id,
            report_job_id=report.id,
            file_name=file_name,
            mime_type="application/pdf" if file_ext == "pdf" else "text/plain",
            storage_path=str(path),
            download_token=secrets.token_urlsafe(24),
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.REPORT_DOWNLOAD_TOKEN_EXPIRE_MINUTES),
        )
        db.add(asset)

        report.status = ReportStatus.completed
        report.completed_at = datetime.now(UTC)
        db.add(report)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        report = db.get(ReportJob, report_id)
        if report:
            report.status = ReportStatus.failed
            report.error = str(exc)
            report.completed_at = datetime.now(UTC)
            db.add(report)
            db.commit()
    finally:
        db.close()

