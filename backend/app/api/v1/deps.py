from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic
from typing import Deque
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole

ROLE_ORDER = {
    WorkspaceRole.viewer: 1,
    WorkspaceRole.editor: 2,
    WorkspaceRole.admin: 3,
    WorkspaceRole.owner: 4,
}


@dataclass
class InMemoryRateLimiter:
    buckets: dict[str, Deque[float]]

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = monotonic()
        bucket = self.buckets.setdefault(key, deque())
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True

    def reset(self) -> None:
        self.buckets.clear()


public_rate_limiter = InMemoryRateLimiter(buckets=defaultdict(deque))


def enforce_public_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{request.url.path}"
    allowed = public_rate_limiter.allow(
        key=key,
        limit=settings.PUBLIC_RATE_LIMIT_REQUESTS,
        window_seconds=settings.PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")


def require_workspace_role(
    db: Session,
    current_user: User,
    workspace_id: UUID,
    minimum_role: WorkspaceRole = WorkspaceRole.viewer,
) -> WorkspaceMember:
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.status == "active",
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    if ROLE_ORDER[member.role] < ROLE_ORDER[minimum_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

    return member
