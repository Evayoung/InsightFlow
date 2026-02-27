from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.survey import QuestionType, SurveyStatus


class SurveyCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    goal: str = Field(min_length=3)
    target_audience: str | None = Field(default=None, max_length=255)
    description: str | None = None
    language: str = Field(default="en", max_length=16)


class SurveyUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    goal: str | None = Field(default=None, min_length=3)
    target_audience: str | None = Field(default=None, max_length=255)
    description: str | None = None
    language: str | None = Field(default=None, max_length=16)


class OptionCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    value: str = Field(min_length=1, max_length=255)
    order: int = Field(ge=1, default=1)


class QuestionCreateRequest(BaseModel):
    type: QuestionType
    text: str = Field(min_length=3)
    description: str | None = None
    required: bool = True
    order: int = Field(ge=1)
    options: list[OptionCreateRequest] = []


class QuestionUpdateRequest(BaseModel):
    type: QuestionType | None = None
    text: str | None = Field(default=None, min_length=3)
    description: str | None = None
    required: bool | None = None
    order: int | None = Field(default=None, ge=1)
    options: list[OptionCreateRequest] | None = None


class SurveyGenerateRequest(BaseModel):
    goal: str = Field(min_length=3)
    target_audience: str | None = None
    question_count: int = Field(default=10, ge=3, le=30)
    tone: str = Field(default="neutral", max_length=64)
    constraints: list[str] = []


class QuestionBiasInput(BaseModel):
    id: UUID | None = None
    text: str = Field(min_length=3)


class BiasCheckRequest(BaseModel):
    questions: list[QuestionBiasInput] | None = None


class SurveyPublishRequest(BaseModel):
    close_at: datetime | None = None


class OptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str
    value: str
    order: int


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_id: UUID
    type: QuestionType
    text: str
    description: str | None
    required: bool
    order: int
    options: list[OptionResponse]


class SurveyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    goal: str
    target_audience: str | None
    description: str | None
    status: SurveyStatus
    language: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class SurveyDetailResponse(BaseModel):
    survey: SurveyResponse
    questions: list[QuestionResponse]


class SurveyListResponse(BaseModel):
    items: list[SurveyResponse]
    count: int


class SurveyPublicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    survey_id: UUID
    public_slug: str
    status: SurveyStatus
    published_at: datetime
    close_at: datetime | None


class BiasIssueResponse(BaseModel):
    question_id: UUID | None
    severity: str
    reason: str
    suggested_rewrite: str


class BiasCheckResponse(BaseModel):
    issues: list[BiasIssueResponse]
    summary: dict


class SurveyQuestionsBundleResponse(BaseModel):
    questions: list[QuestionCreateRequest]
    generation_meta: dict


class PublicSurveyResponse(BaseModel):
    survey: dict
    questions: list[QuestionResponse]

