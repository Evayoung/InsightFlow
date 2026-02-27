from datetime import UTC, datetime
import secrets
import string
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_workspace_role
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.survey import QuestionOption, Survey, SurveyPublication, SurveyQuestion, SurveyStatus
from app.models.user import User
from app.models.workspace import WorkspaceRole
from app.schemas.survey import (
    BiasCheckRequest,
    BiasCheckResponse,
    BiasIssueResponse,
    PublicSurveyResponse,
    QuestionCreateRequest,
    QuestionResponse,
    QuestionUpdateRequest,
    SurveyCreateRequest,
    SurveyDetailResponse,
    SurveyGenerateRequest,
    SurveyListResponse,
    SurveyPublicationResponse,
    SurveyPublishRequest,
    SurveyQuestionsBundleResponse,
    SurveyResponse,
    SurveyUpdateRequest,
)
from app.services.llm import LLMClient, LLMServiceError, get_llm_client

router = APIRouter()
public_router = APIRouter()


def get_llm_dep() -> LLMClient:
    return get_llm_client()


def _get_project_or_404(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_survey_or_404(db: Session, survey_id: UUID) -> Survey:
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey


def _get_question_or_404(db: Session, survey_id: UUID, question_id: UUID) -> SurveyQuestion:
    question = db.scalar(select(SurveyQuestion).where(SurveyQuestion.id == question_id, SurveyQuestion.survey_id == survey_id))
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


def _build_question_response(db: Session, question: SurveyQuestion) -> QuestionResponse:
    options = db.scalars(
        select(QuestionOption).where(QuestionOption.question_id == question.id).order_by(QuestionOption.order_index.asc())
    ).all()
    return QuestionResponse(
        id=question.id,
        survey_id=question.survey_id,
        type=question.type,
        text=question.text,
        description=question.description,
        required=question.required,
        order=question.order_index,
        options=[
            {
                "id": option.id,
                "label": option.label,
                "value": option.value,
                "order": option.order_index,
            }
            for option in options
        ],
    )


def _survey_detail(db: Session, survey: Survey) -> SurveyDetailResponse:
    questions = db.scalars(
        select(SurveyQuestion).where(SurveyQuestion.survey_id == survey.id).order_by(SurveyQuestion.order_index.asc())
    ).all()
    return SurveyDetailResponse(
        survey=SurveyResponse.model_validate(survey),
        questions=[_build_question_response(db, q) for q in questions],
    )


def _create_slug() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "s_" + "".join(secrets.choice(alphabet) for _ in range(12))


@router.post("/projects/{project_id}/surveys", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_survey(
    project_id: UUID,
    payload: SurveyCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyResponse:
    project = _get_project_or_404(db, project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    survey = Survey(
        project_id=project_id,
        title=payload.title,
        goal=payload.goal,
        target_audience=payload.target_audience,
        description=payload.description,
        status=SurveyStatus.draft,
        language=payload.language,
        created_by=user.id,
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyResponse.model_validate(survey)


@router.get("/projects/{project_id}/surveys", response_model=SurveyListResponse)
def list_surveys(
    project_id: UUID,
    status_filter: SurveyStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyListResponse:
    project = _get_project_or_404(db, project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)
    query = select(Survey).where(Survey.project_id == project_id)
    if status_filter:
        query = query.where(Survey.status == status_filter)
    items = db.scalars(query.order_by(Survey.created_at.desc())).all()
    return SurveyListResponse(items=[SurveyResponse.model_validate(x) for x in items], count=len(items))


@router.get("/surveys/{survey_id}", response_model=SurveyDetailResponse)
def get_survey(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyDetailResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)
    return _survey_detail(db, survey)


@router.patch("/surveys/{survey_id}", response_model=SurveyResponse)
def update_survey(
    survey_id: UUID,
    payload: SurveyUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    if payload.title is not None:
        survey.title = payload.title
    if payload.goal is not None:
        survey.goal = payload.goal
    if payload.target_audience is not None:
        survey.target_audience = payload.target_audience
    if payload.description is not None:
        survey.description = payload.description
    if payload.language is not None:
        survey.language = payload.language
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyResponse.model_validate(survey)


@router.post("/surveys/{survey_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def add_question(
    survey_id: UUID,
    payload: QuestionCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)

    question = SurveyQuestion(
        survey_id=survey_id,
        type=payload.type,
        text=payload.text,
        description=payload.description,
        required=payload.required,
        order_index=payload.order,
    )
    db.add(question)
    db.flush()

    for option in payload.options:
        db.add(
            QuestionOption(
                question_id=question.id,
                label=option.label,
                value=option.value,
                order_index=option.order,
            )
        )
    db.commit()
    db.refresh(question)
    return _build_question_response(db, question)


@router.patch("/surveys/{survey_id}/questions/{question_id}", response_model=QuestionResponse)
def update_question(
    survey_id: UUID,
    question_id: UUID,
    payload: QuestionUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    question = _get_question_or_404(db, survey_id, question_id)
    if payload.type is not None:
        question.type = payload.type
    if payload.text is not None:
        question.text = payload.text
    if payload.description is not None:
        question.description = payload.description
    if payload.required is not None:
        question.required = payload.required
    if payload.order is not None:
        question.order_index = payload.order
    if payload.options is not None:
        db.query(QuestionOption).filter(QuestionOption.question_id == question.id).delete()
        for option in payload.options:
            db.add(
                QuestionOption(
                    question_id=question.id,
                    label=option.label,
                    value=option.value,
                    order_index=option.order,
                )
            )
    db.add(question)
    db.commit()
    db.refresh(question)
    return _build_question_response(db, question)


@router.delete("/surveys/{survey_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    survey_id: UUID,
    question_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    question = _get_question_or_404(db, survey_id, question_id)
    db.delete(question)
    db.commit()
    return None


@router.post("/surveys/{survey_id}/ai-generate", response_model=SurveyQuestionsBundleResponse)
def ai_generate_questions(
    survey_id: UUID,
    payload: SurveyGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    llm: LLMClient = Depends(get_llm_dep),
) -> SurveyQuestionsBundleResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)

    schema = {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "text": {"type": "string"},
                        "required": {"type": "boolean"},
                        "order": {"type": "integer"},
                        "options": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "value": {"type": "string"},
                                    "order": {"type": "integer"},
                                },
                                "required": ["label", "value", "order"],
                            },
                        },
                    },
                    "required": ["type", "text", "required", "order"],
                },
            }
        },
        "required": ["questions"],
    }
    try:
        result = llm.generate_json(
            system_prompt="You generate unbiased survey questions as structured JSON.",
            user_prompt=(
                f"Goal: {payload.goal}\nTarget audience: {payload.target_audience}\n"
                f"Question count: {payload.question_count}\nTone: {payload.tone}\n"
                f"Constraints: {payload.constraints}"
            ),
            json_schema=schema,
            temperature=0.3,
            max_tokens=1800,
        )
    except LLMServiceError:
        result = {
            "questions": [
                {"type": "text", "text": f"What is your top feedback about: {payload.goal}?", "required": True, "order": 1, "options": []},
                {"type": "rating", "text": "How satisfied are you overall?", "required": True, "order": 2, "options": []},
                {"type": "text", "text": "What should we improve first?", "required": False, "order": 3, "options": []},
            ]
        }

    for item in result.get("questions", []):
        db.add(
            SurveyQuestion(
                survey_id=survey_id,
                type=item.get("type", "text"),
                text=item.get("text", ""),
                required=bool(item.get("required", True)),
                order_index=int(item.get("order", 1)),
            )
        )
    survey.generated_by_ai = True
    db.add(survey)
    db.commit()
    return SurveyQuestionsBundleResponse(
        questions=result.get("questions", []),
        generation_meta={"provider": "groq", "generated_at": datetime.now(UTC).isoformat()},
    )


@router.post("/surveys/{survey_id}/bias-check", response_model=BiasCheckResponse)
def bias_check(
    survey_id: UUID,
    payload: BiasCheckRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    llm: LLMClient = Depends(get_llm_dep),
) -> BiasCheckResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)

    if payload.questions is not None:
        question_inputs = payload.questions
    else:
        existing = db.scalars(select(SurveyQuestion).where(SurveyQuestion.survey_id == survey_id)).all()
        question_inputs = [{"id": q.id, "text": q.text} for q in existing]

    schema = {
        "type": "object",
        "properties": {
            "issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question_id": {"type": ["string", "null"]},
                        "severity": {"type": "string"},
                        "reason": {"type": "string"},
                        "suggested_rewrite": {"type": "string"},
                    },
                    "required": ["question_id", "severity", "reason", "suggested_rewrite"],
                },
            }
        },
        "required": ["issues"],
    }
    try:
        result = llm.generate_json(
            system_prompt="You are a survey methodology expert. Detect leading/biased questions and suggest neutral rewrites.",
            user_prompt=f"Analyze these questions for bias and clarity: {question_inputs}",
            json_schema=schema,
            temperature=0.1,
            max_tokens=1200,
        )
        issues = result.get("issues", [])
    except LLMServiceError:
        issues = []

    response_issues = [
        BiasIssueResponse(
            question_id=UUID(item["question_id"]) if item.get("question_id") else None,
            severity=item.get("severity", "low"),
            reason=item.get("reason", "No issue detected"),
            suggested_rewrite=item.get("suggested_rewrite", ""),
        )
        for item in issues
    ]
    return BiasCheckResponse(
        issues=response_issues,
        summary={"total_questions": len(question_inputs), "flagged_questions": len(response_issues)},
    )


@router.post("/surveys/{survey_id}/publish", response_model=SurveyPublicationResponse)
def publish_survey(
    survey_id: UUID,
    payload: SurveyPublishRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyPublicationResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    if survey.status not in {SurveyStatus.draft, SurveyStatus.closed}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey cannot be published in current state")

    publication = db.scalar(select(SurveyPublication).where(SurveyPublication.survey_id == survey_id))
    if not publication:
        publication = SurveyPublication(
            survey_id=survey_id,
            public_slug=_create_slug(),
            status=SurveyStatus.published,
            published_at=datetime.now(UTC),
            close_at=payload.close_at,
        )
        db.add(publication)
    else:
        publication.status = SurveyStatus.published
        publication.published_at = datetime.now(UTC)
        publication.close_at = payload.close_at
        db.add(publication)

    survey.status = SurveyStatus.published
    db.add(survey)
    db.commit()
    db.refresh(publication)
    return SurveyPublicationResponse.model_validate(publication)


@router.post("/surveys/{survey_id}/close", response_model=SurveyResponse)
def close_survey(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    survey.status = SurveyStatus.closed
    publication = db.scalar(select(SurveyPublication).where(SurveyPublication.survey_id == survey_id))
    if publication:
        publication.status = SurveyStatus.closed
        db.add(publication)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyResponse.model_validate(survey)


@router.post("/surveys/{survey_id}/archive", response_model=SurveyResponse)
def archive_survey(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyResponse:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    survey.status = SurveyStatus.archived
    publication = db.scalar(select(SurveyPublication).where(SurveyPublication.survey_id == survey_id))
    if publication:
        publication.status = SurveyStatus.archived
        db.add(publication)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyResponse.model_validate(survey)


@public_router.get("/public/surveys/{public_slug}", response_model=PublicSurveyResponse)
def public_get_survey(public_slug: str, db: Session = Depends(get_db)) -> PublicSurveyResponse:
    publication = db.scalar(select(SurveyPublication).where(SurveyPublication.public_slug == public_slug))
    if not publication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if publication.status != SurveyStatus.published:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey is not currently accepting responses.")

    survey = _get_survey_or_404(db, publication.survey_id)
    questions = db.scalars(
        select(SurveyQuestion).where(SurveyQuestion.survey_id == survey.id).order_by(SurveyQuestion.order_index.asc())
    ).all()
    return PublicSurveyResponse(
        survey={"id": survey.id, "title": survey.title, "description": survey.description},
        questions=[_build_question_response(db, q) for q in questions],
    )
