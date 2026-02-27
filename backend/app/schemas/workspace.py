from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.workspace import WorkspaceRole


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class WorkspaceUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceResponse]


class MemberInviteRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole = WorkspaceRole.editor


class MemberUpdateRequest(BaseModel):
    role: WorkspaceRole | None = None
    status: str | None = None


class WorkspaceMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    user_id: UUID
    role: WorkspaceRole
    status: str
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberListResponse(BaseModel):
    items: list[WorkspaceMemberResponse]

