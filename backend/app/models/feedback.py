import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class InsightRunStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class SurveyResponse(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "survey_responses"

    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    respondent_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ResponseAnswer(Base, UUIDMixin):
    __tablename__ = "response_answers"

    response_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_questions.id", ondelete="CASCADE"), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class InsightRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "insight_runs"

    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[InsightRunStatus] = mapped_column(Enum(InsightRunStatus), nullable=False, default=InsightRunStatus.queued)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class InsightSummary(Base, UUIDMixin):
    __tablename__ = "insight_summaries"

    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insight_runs.id", ondelete="CASCADE"), nullable=False, unique=True)
    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    overview: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment_distribution: Mapped[dict] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class InsightTheme(Base, UUIDMixin):
    __tablename__ = "insight_themes"

    summary_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insight_summaries.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(32), nullable=False)
    sample_quote: Mapped[str | None] = mapped_column(Text, nullable=True)


class InsightRecommendation(Base, UUIDMixin):
    __tablename__ = "insight_recommendations"

    summary_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insight_summaries.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(32), nullable=False)
    expected_impact: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Persona(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "personas"

    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("insight_runs.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_traits: Mapped[list] = mapped_column(JSON, nullable=False)
    frustrations: Mapped[list] = mapped_column(JSON, nullable=False)
    goals: Mapped[list] = mapped_column(JSON, nullable=False)
    confidence: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")

