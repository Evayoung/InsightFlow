from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select

from app.db.session import SessionLocal
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
from app.models.survey import Survey
from app.services.llm import LLMServiceError, get_llm_client


def _heuristic_sentiment(text: str) -> str:
    normalized = text.lower()
    positive = ["good", "great", "love", "easy", "clear", "excellent", "fast"]
    negative = ["bad", "hate", "hard", "confusing", "slow", "bug", "poor"]
    pos_score = sum(1 for token in positive if token in normalized)
    neg_score = sum(1 for token in negative if token in normalized)
    if pos_score > neg_score:
        return "positive"
    if neg_score > pos_score:
        return "negative"
    return "neutral"


def _fallback_insight_payload(answer_texts: list[str]) -> dict[str, Any]:
    sentiments = {"positive": 0, "neutral": 0, "negative": 0}
    for text in answer_texts:
        sentiments[_heuristic_sentiment(text)] += 1

    total = max(len(answer_texts), 1)
    dist = {
        "positive": round(sentiments["positive"] / total, 4),
        "neutral": round(sentiments["neutral"] / total, 4),
        "negative": round(sentiments["negative"] / total, 4),
    }
    return {
        "overview": "Insights generated from submitted responses.",
        "sentiment_distribution": dist,
        "themes": [
            {
                "label": "general feedback",
                "count": len(answer_texts),
                "sentiment": "neutral",
                "sample_quote": answer_texts[0] if answer_texts else None,
            }
        ],
        "recommendations": [
            {
                "title": "Review top feedback themes weekly",
                "detail": "Track recurring complaints and prioritize fixes in next sprint.",
                "priority": "medium",
                "expected_impact": "improve user satisfaction",
            }
        ],
    }


def run_insight_analysis(run_id: UUID) -> None:
    db = SessionLocal()
    try:
        run = db.get(InsightRun, run_id)
        if not run:
            return
        run.status = InsightRunStatus.running
        run.started_at = datetime.now(UTC)
        db.add(run)
        db.commit()

        survey = db.get(Survey, run.survey_id)
        if not survey:
            raise RuntimeError("Survey not found for run")

        response_rows = db.scalars(select(SurveyResponse).where(SurveyResponse.survey_id == run.survey_id)).all()
        response_ids = [row.id for row in response_rows]
        answers = []
        if response_ids:
            answers = db.scalars(select(ResponseAnswer).where(ResponseAnswer.response_id.in_(response_ids))).all()
        answer_texts = [a.value for a in answers]

        schema = {
            "type": "object",
            "properties": {
                "overview": {"type": "string"},
                "sentiment_distribution": {"type": "object"},
                "themes": {"type": "array"},
                "recommendations": {"type": "array"},
            },
            "required": ["overview", "sentiment_distribution", "themes", "recommendations"],
        }
        try:
            llm = get_llm_client()
            payload = llm.generate_json(
                system_prompt="Analyze survey responses and produce concise actionable product insights in JSON.",
                user_prompt=f"Responses: {answer_texts}",
                json_schema=schema,
                temperature=0.2,
                max_tokens=1600,
            )
        except LLMServiceError:
            payload = _fallback_insight_payload(answer_texts)

        existing_summary = db.scalar(select(InsightSummary).where(InsightSummary.run_id == run_id))
        if existing_summary:
            db.execute(delete(InsightTheme).where(InsightTheme.summary_id == existing_summary.id))
            db.execute(delete(InsightRecommendation).where(InsightRecommendation.summary_id == existing_summary.id))
            db.delete(existing_summary)
            db.flush()

        summary = InsightSummary(
            run_id=run_id,
            survey_id=run.survey_id,
            overview=payload.get("overview", "No overview generated."),
            sentiment_distribution=payload.get("sentiment_distribution", {"positive": 0, "neutral": 1, "negative": 0}),
            generated_at=datetime.now(UTC),
        )
        db.add(summary)
        db.flush()

        themes = payload.get("themes", [])
        if not isinstance(themes, list):
            themes = []
        for theme in themes[:10]:
            if not isinstance(theme, dict):
                continue
            db.add(
                InsightTheme(
                    summary_id=summary.id,
                    label=theme.get("label", "theme"),
                    count=int(theme.get("count", 0)),
                    sentiment=theme.get("sentiment", "neutral"),
                    sample_quote=theme.get("sample_quote"),
                )
            )

        recommendations = payload.get("recommendations", [])
        if not isinstance(recommendations, list):
            recommendations = []
        for rec in recommendations[:10]:
            if not isinstance(rec, dict):
                continue
            db.add(
                InsightRecommendation(
                    summary_id=summary.id,
                    title=rec.get("title", "Recommendation"),
                    detail=rec.get("detail", ""),
                    priority=rec.get("priority", "medium"),
                    expected_impact=rec.get("expected_impact"),
                )
            )

        run.status = InsightRunStatus.completed
        run.completed_at = datetime.now(UTC)
        db.add(run)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        run = db.get(InsightRun, run_id)
        if run:
            run.status = InsightRunStatus.failed
            run.error = str(exc)
            run.completed_at = datetime.now(UTC)
            db.add(run)
            db.commit()
    finally:
        db.close()


def generate_personas_for_survey(survey_id: UUID, run_id: UUID | None = None) -> None:
    db = SessionLocal()
    try:
        summaries_query = select(InsightSummary).where(InsightSummary.survey_id == survey_id).order_by(InsightSummary.generated_at.desc())
        if run_id:
            summaries_query = select(InsightSummary).where(InsightSummary.run_id == run_id)
        summary = db.scalar(summaries_query)
        if not summary:
            return

        db.execute(delete(Persona).where(Persona.survey_id == survey_id))
        db.flush()

        payload = {
            "items": [
                {
                    "name": "Clarity Seeker",
                    "summary": "Wants clear product communication before adopting features.",
                    "key_traits": ["detail-oriented", "decision cautious"],
                    "frustrations": ["unclear pricing", "ambiguous value"],
                    "goals": ["quickly understand benefits"],
                    "confidence": "medium",
                }
            ]
        }
        try:
            llm = get_llm_client()
            schema = {
                "type": "object",
                "properties": {"items": {"type": "array"}},
                "required": ["items"],
            }
            payload = llm.generate_json(
                system_prompt="Generate concise personas from survey insight summary.",
                user_prompt=f"Overview: {summary.overview}\nSentiment: {summary.sentiment_distribution}",
                json_schema=schema,
                temperature=0.2,
                max_tokens=1000,
            )
        except LLMServiceError:
            pass

        for item in payload.get("items", [])[:5]:
            db.add(
                Persona(
                    survey_id=survey_id,
                    run_id=summary.run_id,
                    name=item.get("name", "Persona"),
                    summary=item.get("summary", ""),
                    key_traits=item.get("key_traits", []),
                    frustrations=item.get("frustrations", []),
                    goals=item.get("goals", []),
                    confidence=item.get("confidence", "medium"),
                )
            )
        db.commit()
    finally:
        db.close()
