from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_workspace_role
from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole
from app.schemas.workspace import (
    MemberInviteRequest,
    MemberUpdateRequest,
    WorkspaceCreateRequest,
    WorkspaceListResponse,
    WorkspaceMemberListResponse,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from app.services.events import log_audit_event, log_usage_event
from app.services.email import send_workspace_invitation_email

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_member_response(member: WorkspaceMember, user: User) -> WorkspaceMemberResponse:
    return WorkspaceMemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        email=user.email,
        full_name=user.full_name,
        role=member.role,
        status=member.status,
        joined_at=member.created_at,
        invited_at=member.created_at,
        kind="member",
    )


def _build_invitation_response(invitation: WorkspaceInvitation) -> WorkspaceMemberResponse:
    return WorkspaceMemberResponse(
        id=invitation.id,
        workspace_id=invitation.workspace_id,
        user_id=None,
        email=invitation.email,
        full_name=None,
        role=invitation.role,
        status=invitation.status,
        joined_at=None,
        invited_at=invitation.created_at,
        kind="invitation",
    )


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    workspace = Workspace(name=payload.name, owner_id=user.id)
    db.add(workspace)
    db.flush()

    owner_membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=WorkspaceRole.owner,
        status="active",
    )
    db.add(owner_membership)
    db.flush()
    log_audit_event(
        db,
        action="workspace.create",
        entity_type="workspace",
        entity_id=str(workspace.id),
        actor_user_id=user.id,
        workspace_id=workspace.id,
        metadata={"name": workspace.name},
    )
    log_usage_event(db, event_name="workspace.created", user_id=user.id, workspace_id=workspace.id)
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceListResponse:
    workspaces = db.scalars(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id, WorkspaceMember.status == "active")
        .order_by(Workspace.created_at.desc())
    ).all()
    return WorkspaceListResponse(items=[WorkspaceResponse.model_validate(item) for item in workspaces])


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.viewer)
    workspace = db.get(Workspace, workspace_id)
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.admin)
    workspace = db.get(Workspace, workspace_id)
    workspace.name = payload.name
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.post("/{workspace_id}/members/invite", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
def invite_member(
    workspace_id: UUID,
    payload: MemberInviteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceMemberResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.admin)
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    normalized_email = payload.email.lower()
    invited_user = db.scalar(select(User).where(User.email == normalized_email))

    if invited_user:
        stale_invitation = db.scalar(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.email == normalized_email,
            )
        )
        existing = db.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == invited_user.id,
            )
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Member already exists")
        if stale_invitation:
            db.delete(stale_invitation)
            db.flush()

        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=invited_user.id,
            role=payload.role,
            status="active",
        )
        db.add(member)
        db.flush()
        log_audit_event(
            db,
            action="workspace.member.invite",
            entity_type="workspace_member",
            entity_id=str(member.id),
            actor_user_id=user.id,
            workspace_id=workspace_id,
            metadata={"invited_user_id": str(invited_user.id), "role": payload.role.value},
        )
        response_payload = _build_member_response(member, invited_user)
    else:
        existing_invitation = db.scalar(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.email == normalized_email,
            )
        )
        if existing_invitation:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already exists")

        invitation = WorkspaceInvitation(
            workspace_id=workspace_id,
            email=normalized_email,
            role=payload.role,
            invited_by_user_id=user.id,
            status="pending",
        )
        db.add(invitation)
        db.flush()
        log_audit_event(
            db,
            action="workspace.member.invite_pending",
            entity_type="workspace_invitation",
            entity_id=str(invitation.id),
            actor_user_id=user.id,
            workspace_id=workspace_id,
            metadata={"email": normalized_email, "role": payload.role.value},
        )
        response_payload = _build_invitation_response(invitation)

    db.commit()

    invite_link = f"{settings.FRONTEND_APP_URL.rstrip('/')}/pages/login.html"
    invite_email = invited_user.email if invited_user else normalized_email
    if not send_workspace_invitation_email(
        invite_email,
        workspace_name=workspace.name,
        role=payload.role.value,
        inviter_name=user.full_name,
        app_link=invite_link,
    ):
        logger.warning(
            "Workspace invite email delivery failed for workspace_id=%s email=%s",
            workspace_id,
            invite_email,
        )
    return response_payload


@router.get("/{workspace_id}/members", response_model=WorkspaceMemberListResponse)
def list_members(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceMemberListResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.viewer)
    members = db.scalars(
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at.asc())
    ).all()
    invitations = db.scalars(
        select(WorkspaceInvitation)
        .where(WorkspaceInvitation.workspace_id == workspace_id, WorkspaceInvitation.status == "pending")
        .order_by(WorkspaceInvitation.created_at.asc())
    ).all()

    member_items = []
    for item in members:
        member_user = db.get(User, item.user_id)
        if not member_user:
            continue
        member_items.append(_build_member_response(item, member_user))

    invitation_items = [_build_invitation_response(item) for item in invitations]
    return WorkspaceMemberListResponse(items=member_items + invitation_items)


@router.patch("/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberResponse)
def update_member(
    workspace_id: UUID,
    member_id: UUID,
    payload: MemberUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceMemberResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.admin)
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == workspace_id,
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role == WorkspaceRole.owner:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner membership cannot be modified")

    if payload.role is not None:
        member.role = payload.role
    if payload.status is not None:
        member.status = payload.status
    db.add(member)
    db.commit()
    db.refresh(member)
    return WorkspaceMemberResponse.model_validate(member)


@router.delete("/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    workspace_id: UUID,
    member_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.admin)
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == workspace_id,
        )
    )
    if member:
        if member.role == WorkspaceRole.owner:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner membership cannot be removed")
        db.delete(member)
        db.commit()
        return None

    invitation = db.scalar(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.id == member_id,
            WorkspaceInvitation.workspace_id == workspace_id,
        )
    )
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    db.delete(invitation)
    db.commit()
    return None
