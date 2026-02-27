from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict:
    checks = {"db": "ok", "scheduler": "n/a", "provider": "n/a"}
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": {"db": "error"}, "error": str(exc)},
        ) from exc

    return {"status": "ready", "checks": checks}


@router.get("/meta")
def meta() -> dict[str, str]:
    return {
        "service": settings.APP_SLUG,
        "version": settings.APP_VERSION,
    }

