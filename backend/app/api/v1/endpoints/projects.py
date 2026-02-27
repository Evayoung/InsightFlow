from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_workspace_role
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.models.workspace import WorkspaceRole
from app.schemas.project import ProjectCreateRequest, ProjectListResponse, ProjectResponse, ProjectUpdateRequest

router = APIRouter()


@router.post("/workspaces/{workspace_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    workspace_id: UUID,
    payload: ProjectCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.editor)
    project = Project(
        workspace_id=workspace_id,
        name=payload.name,
        description=payload.description,
        status="active",
        created_by=user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.get("/workspaces/{workspace_id}/projects", response_model=ProjectListResponse)
def list_projects(
    workspace_id: UUID,
    status_filter: str | None = Query(default=None, alias="status"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectListResponse:
    require_workspace_role(db, user, workspace_id, WorkspaceRole.viewer)

    query = select(Project).where(Project.workspace_id == workspace_id)
    if status_filter:
        query = query.where(Project.status == status_filter)

    projects = db.scalars(query.order_by(Project.created_at.desc()).limit(limit)).all()
    return ProjectListResponse(
        items=[ProjectResponse.model_validate(item) for item in projects],
        next_cursor=None,
        count=len(projects),
    )


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)
    return ProjectResponse.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    payload: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        project.status = payload.status

    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    project.status = "archived"
    db.add(project)
    db.commit()
    return None
