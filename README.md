# InsightFlow

InsightFlow is an AI-powered survey and feedback intelligence platform built to help teams move from raw responses to clear, actionable decisions.

It supports the full loop:
- Define a research/product goal
- Generate smart survey questions with AI
- Detect and reduce question bias
- Collect responses
- Analyze sentiment, themes, and recommendations
- Export insight reports for sharing

## Product Vision
InsightFlow helps startups, product teams, and businesses understand user feedback faster by converting messy response data into clear direction.

## Problem We Solve
Most survey tools focus on collection, not interpretation. Teams still struggle with:
- writing quality unbiased questions
- extracting meaning from responses
- turning feedback into concrete actions

InsightFlow addresses this with AI-assisted survey design, automated analysis, and exportable insights.

## Primary Users
- Product Managers
- Startup Founders
- Business Owners

Secondary users:
- Researchers
- Marketing Teams

## MVP Scope
Must-have:
- AI survey generation
- Bias detection and rewrite suggestions
- Survey publish/share flow
- Response collection
- AI insight summaries (themes, sentiment, recommendations)
- Report export (PDF/slide-ready output)

Should-have:
- Team collaboration basics
- Completion-rate analytics

Out of scope (for now):
- Offline survey mode
- Slack/Notion integrations
- Full multilingual workflow

## Architecture Direction (MVP)
- FastAPI backend (modular monolith)
- PostgreSQL for persistence
- In-process async tasks via FastAPI `BackgroundTasks` and/or APScheduler
- Optional FastAPI Cache for targeted caching
- No Redis/Celery/service broker in MVP (cost and complexity reduction)

Scale-up path:
- Introduce Redis + Celery when traffic, reliability, or workload requires brokered background processing.

## Repository Structure
```text
InsightFlow/
├─ backend/         # Backend service (implementation details to be added)
├─ frontend/        # Frontend app (maintained by frontend team)
├─ docs/            # Product and engineering source-of-truth docs
├─ LICENSE
└─ README.md
```

## Documentation Hub
Use these as the single source of truth for cross-team alignment:

1. Development Plan: `docs/01-development-plan.md`
2. Technical Development Document: `docs/02-technical-development-document.md`
3. Full Route Spec: `docs/03-full-route-spec.md`
4. Complete Schema Contracts: `docs/04-schema-contracts.md`
5. Screen Specification: `docs/05-screen-specification.md`

Recommended reading order:
1. `docs/01-development-plan.md`
2. `docs/02-technical-development-document.md`
3. `docs/03-full-route-spec.md`
4. `docs/04-schema-contracts.md`
5. `docs/05-screen-specification.md`

## Team Responsibilities
- Backend team: API, domain logic, AI orchestration, data model, export pipeline
- Frontend team: UI/UX implementation based on screen spec + API contracts
- Shared ownership: keeping docs in `docs/` current whenever contracts change

## Current Status
- PRD translated into implementation-ready engineering docs
- Repository scaffold in place (`backend/`, `frontend/`, `docs/`)
- Backend implementation details and setup steps will be added in `backend/README.md` when development starts

## Change Control
If routes or schema contracts change, update all affected docs:
- `docs/03-full-route-spec.md`
- `docs/04-schema-contracts.md`
- `docs/05-screen-specification.md`
