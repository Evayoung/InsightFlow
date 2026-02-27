from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.hardening import AuditEvent, UsageEvent


def log_audit_event(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    actor_user_id: UUID | None = None,
    workspace_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditEvent(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_user_id=actor_user_id,
            workspace_id=workspace_id,
            event_data=metadata,
            created_at=datetime.now(UTC),
        )
    )


def log_usage_event(
    db: Session,
    *,
    event_name: str,
    user_id: UUID | None = None,
    workspace_id: UUID | None = None,
    payload: dict | None = None,
) -> None:
    db.add(
        UsageEvent(
            event_name=event_name,
            user_id=user_id,
            workspace_id=workspace_id,
            payload=payload,
            created_at=datetime.now(UTC),
        )
    )
