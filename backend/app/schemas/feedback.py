from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.feedback import InsightRunStatus


class ResponseAnswerIn(BaseModel):
    question_id: UUID
    value: str = Field(min_length=1)


class PublicResponseSubmitRequest(BaseModel):
    answers: list[ResponseAnswerIn]
    respondent_meta: dict | None = None


class ResponseAccepted(BaseModel):
    response_id: UUID
    survey_id: UUID
    status: str
    submitted_at: datetime


class ResponseAnswerOut(BaseModel):
    question_id: UUID
    value: str


class SurveyResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_id: UUID
    submitted_at: datetime
    respondent_meta: dict | None
    answers: list[ResponseAnswerOut]


class SurveyResponseList(BaseModel):
    items: list[SurveyResponseOut]
    count: int


class InsightsRunRequest(BaseModel):
    force: bool = False


class InsightRunAccepted(BaseModel):
    run_id: UUID
    status: InsightRunStatus
    accepted_at: datetime


class InsightThemeOut(BaseModel):
    id: UUID
    label: str
    count: int
    sentiment: str
    sample_quote: str | None


class InsightRecommendationOut(BaseModel):
    id: UUID
    title: str
    detail: str
    priority: str
    expected_impact: str | None


class InsightBundle(BaseModel):
    survey_id: UUID
    run_id: UUID
    overview: str
    sentiment_distribution: dict
    themes: list[InsightThemeOut]
    recommendations: list[InsightRecommendationOut]
    generated_at: datetime


class InsightRunDetail(BaseModel):
    run_id: UUID
    survey_id: UUID
    status: InsightRunStatus
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    insight: InsightBundle | None = None


class PersonaGenerateRequest(BaseModel):
    force: bool = False


class PersonaOut(BaseModel):
    id: UUID
    survey_id: UUID
    run_id: UUID | None
    name: str
    summary: str
    key_traits: list
    frustrations: list
    goals: list
    confidence: str


class PersonaList(BaseModel):
    items: list[PersonaOut]
    count: int


class CompletionMetric(BaseModel):
    survey_id: UUID
    generated_ai_surveys: int
    completed_ai_surveys: int
    completion_rate: float
    total_responses: int

