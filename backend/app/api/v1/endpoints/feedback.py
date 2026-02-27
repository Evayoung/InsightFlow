from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.deps import require_workspace_role
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.feedback import (
    InsightRecommendation,
    InsightRun,
    InsightRunStatus,
    InsightSummary,
    InsightTheme,
    Persona,
    ResponseAnswer,
    SurveyResponse,
)
from app.models.project import Project
from app.models.survey import Survey, SurveyPublication, SurveyQuestion, SurveyStatus
from app.models.user import User
from app.models.workspace import WorkspaceRole
from app.schemas.feedback import (
    CompletionMetric,
    InsightBundle,
    InsightRecommendationOut,
    InsightRunAccepted,
    InsightRunDetail,
    InsightThemeOut,
    InsightsRunRequest,
    PersonaGenerateRequest,
    PersonaList,
    PersonaOut,
    PublicResponseSubmitRequest,
    ResponseAccepted,
    ResponseAnswerOut,
    SurveyResponseList,
    SurveyResponseOut,
)
from app.services.insights import generate_personas_for_survey, run_insight_analysis

router = APIRouter()
public_router = APIRouter()


def _get_survey_or_404(db: Session, survey_id: UUID) -> Survey:
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey


def _get_project_or_404(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _response_out(db: Session, row: SurveyResponse) -> SurveyResponseOut:
    answers = db.scalars(select(ResponseAnswer).where(ResponseAnswer.response_id == row.id)).all()
    return SurveyResponseOut(
        id=row.id,
        survey_id=row.survey_id,
        submitted_at=row.submitted_at,
        respondent_meta=row.respondent_meta,
        answers=[ResponseAnswerOut(question_id=a.question_id, value=a.value) for a in answers],
    )


def _build_insight_bundle(db: Session, summary: InsightSummary) -> InsightBundle:
    themes = db.scalars(select(InsightTheme).where(InsightTheme.summary_id == summary.id)).all()
    recs = db.scalars(select(InsightRecommendation).where(InsightRecommendation.summary_id == summary.id)).all()
    return InsightBundle(
        survey_id=summary.survey_id,
        run_id=summary.run_id,
        overview=summary.overview,
        sentiment_distribution=summary.sentiment_distribution,
        themes=[
            InsightThemeOut(
                id=t.id,
                label=t.label,
                count=t.count,
                sentiment=t.sentiment,
                sample_quote=t.sample_quote,
            )
            for t in themes
        ],
        recommendations=[
            InsightRecommendationOut(
                id=r.id,
                title=r.title,
                detail=r.detail,
                priority=r.priority,
                expected_impact=r.expected_impact,
            )
            for r in recs
        ],
        generated_at=summary.generated_at,
    )


@public_router.post("/public/surveys/{public_slug}/responses", response_model=ResponseAccepted, status_code=status.HTTP_201_CREATED)
def submit_public_response(
    public_slug: str,
    payload: PublicResponseSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ResponseAccepted:
    publication = db.scalar(select(SurveyPublication).where(SurveyPublication.public_slug == public_slug))
    if not publication:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if publication.status != SurveyStatus.published:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey is not currently accepting responses.")

    survey = db.get(Survey, publication.survey_id)
    questions = db.scalars(select(SurveyQuestion).where(SurveyQuestion.survey_id == survey.id)).all()
    question_map = {q.id: q for q in questions}
    required_ids = {q.id for q in questions if q.required}
    submitted_ids = {a.question_id for a in payload.answers}
    missing = required_ids - submitted_ids
    if missing:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing required answers")

    for answer in payload.answers:
        if answer.question_id not in question_map:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid question_id")

    response = SurveyResponse(
        survey_id=survey.id,
        submitted_at=datetime.now(UTC),
        respondent_meta=payload.respondent_meta,
    )
    db.add(response)
    db.flush()

    for answer in payload.answers:
        db.add(
            ResponseAnswer(
                response_id=response.id,
                question_id=answer.question_id,
                value=answer.value,
            )
        )
    db.commit()
    db.refresh(response)

    # Auto-trigger an insight run for latest responses.
    run = InsightRun(survey_id=survey.id, status=InsightRunStatus.queued)
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(run_insight_analysis, run.id)

    return ResponseAccepted(
        response_id=response.id,
        survey_id=survey.id,
        status="accepted",
        submitted_at=response.submitted_at,
    )


@router.get("/surveys/{survey_id}/responses", response_model=SurveyResponseList)
def list_responses(
    survey_id: UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyResponseList:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)

    rows = db.scalars(
        select(SurveyResponse).where(SurveyResponse.survey_id == survey_id).order_by(SurveyResponse.submitted_at.desc()).limit(limit)
    ).all()
    return SurveyResponseList(items=[_response_out(db, row) for row in rows], count=len(rows))


@router.get("/surveys/{survey_id}/responses/{response_id}", response_model=SurveyResponseOut)
def get_response(
    survey_id: UUID,
    response_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SurveyResponseOut:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)
    row = db.scalar(select(SurveyResponse).where(SurveyResponse.id == response_id, SurveyResponse.survey_id == survey_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Response not found")
    return _response_out(db, row)


@router.post("/surveys/{survey_id}/insights/run", response_model=InsightRunAccepted, status_code=status.HTTP_202_ACCEPTED)
def run_insights(
    survey_id: UUID,
    _: InsightsRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InsightRunAccepted:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    run = InsightRun(survey_id=survey_id, status=InsightRunStatus.queued)
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(run_insight_analysis, run.id)
    return InsightRunAccepted(run_id=run.id, status=run.status, accepted_at=run.created_at)


@router.get("/surveys/{survey_id}/insights/latest", response_model=InsightBundle)
def latest_insights(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InsightBundle:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)
    summary = db.scalar(select(InsightSummary).where(InsightSummary.survey_id == survey_id).order_by(InsightSummary.generated_at.desc()))
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No insights available")
    return _build_insight_bundle(db, summary)


@router.get("/surveys/{survey_id}/insights/runs/{run_id}", response_model=InsightRunDetail)
def insight_run_detail(
    survey_id: UUID,
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InsightRunDetail:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)

    run = db.scalar(select(InsightRun).where(InsightRun.id == run_id, InsightRun.survey_id == survey_id))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight run not found")

    summary = db.scalar(select(InsightSummary).where(InsightSummary.run_id == run.id))
    bundle = _build_insight_bundle(db, summary) if summary else None
    return InsightRunDetail(
        run_id=run.id,
        survey_id=run.survey_id,
        status=run.status,
        error=run.error,
        started_at=run.started_at,
        completed_at=run.completed_at,
        insight=bundle,
    )


@router.post("/surveys/{survey_id}/personas/generate", response_model=PersonaList)
def generate_personas(
    survey_id: UUID,
    _: PersonaGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PersonaList:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.editor)
    generate_personas_for_survey(survey_id)
    rows = db.scalars(select(Persona).where(Persona.survey_id == survey_id).order_by(Persona.created_at.desc())).all()
    items = [
        PersonaOut(
            id=row.id,
            survey_id=row.survey_id,
            run_id=row.run_id,
            name=row.name,
            summary=row.summary,
            key_traits=row.key_traits,
            frustrations=row.frustrations,
            goals=row.goals,
            confidence=row.confidence,
        )
        for row in rows
    ]
    return PersonaList(items=items, count=len(items))


@router.get("/surveys/{survey_id}/personas", response_model=PersonaList)
def list_personas(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PersonaList:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)
    rows = db.scalars(select(Persona).where(Persona.survey_id == survey_id).order_by(Persona.created_at.desc())).all()
    items = [
        PersonaOut(
            id=row.id,
            survey_id=row.survey_id,
            run_id=row.run_id,
            name=row.name,
            summary=row.summary,
            key_traits=row.key_traits,
            frustrations=row.frustrations,
            goals=row.goals,
            confidence=row.confidence,
        )
        for row in rows
    ]
    return PersonaList(items=items, count=len(items))


@router.get("/surveys/{survey_id}/analytics/completion", response_model=CompletionMetric)
def completion_metric(
    survey_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CompletionMetric:
    survey = _get_survey_or_404(db, survey_id)
    project = _get_project_or_404(db, survey.project_id)
    require_workspace_role(db, user, project.workspace_id, WorkspaceRole.viewer)

    total_responses = db.scalar(select(func.count(SurveyResponse.id)).where(SurveyResponse.survey_id == survey_id)) or 0
    generated_ai_surveys = 1 if survey.generated_by_ai else 0
    completed_ai_surveys = 1 if survey.generated_by_ai and total_responses > 0 else 0
    completion_rate = (completed_ai_surveys / generated_ai_surveys * 100.0) if generated_ai_surveys else 0.0
    return CompletionMetric(
        survey_id=survey_id,
        generated_ai_surveys=generated_ai_surveys,
        completed_ai_surveys=completed_ai_surveys,
        completion_rate=round(completion_rate, 2),
        total_responses=int(total_responses),
    )
