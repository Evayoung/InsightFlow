import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class SurveyStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"
    archived = "archived"


class QuestionType(str, enum.Enum):
    single_choice = "single_choice"
    multi_choice = "multi_choice"
    rating = "rating"
    text = "text"
    nps = "nps"
    yes_no = "yes_no"


class Survey(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "surveys"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    target_audience: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SurveyStatus] = mapped_column(Enum(SurveyStatus), nullable=False, default=SurveyStatus.draft)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="en")
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


class SurveyQuestion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "survey_questions"

    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class QuestionOption(Base, UUIDMixin):
    __tablename__ = "question_options"
    __table_args__ = (UniqueConstraint("question_id", "order_index", name="uq_question_options_question_order"),)

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_questions.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class SurveyPublication(Base, UUIDMixin):
    __tablename__ = "survey_publications"

    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False, unique=True)
    public_slug: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    status: Mapped[SurveyStatus] = mapped_column(Enum(SurveyStatus), nullable=False, default=SurveyStatus.published)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    close_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
