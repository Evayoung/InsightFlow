# InsightFlow Technical Development Document (Backend)

## 1. Purpose
Define the backend architecture and engineering decisions for InsightFlow using FastAPI, aligned to PRD goals: goal-to-survey generation, bias detection, response analysis, and report export.

## 2. System Context
Actors:
- Workspace users (PMs, founders, researchers)
- Survey respondents (public or invite-based)
- AI provider(s)

Primary flow:
1. Authenticated user creates project and submits survey goal
2. AI generates questions
3. User edits + publishes survey
4. Respondents submit answers
5. Async pipeline analyzes responses
6. User views insights and exports report

## 3. Architecture
Pattern:
- Modular monolith (initial MVP), clean domain boundaries
- REST API + lightweight async execution (in-process background tasks or APScheduler)
- Postgres for transactional data
- Optional FastAPI Cache for selective read/performance optimization
- Object storage (S3-compatible) for export assets

Layers:
- `api`: routers, request/response models, auth guards
- `service`: domain orchestration and business rules
- `repository`: persistence abstraction
- `integrations`: AI provider, file export provider, email/webhook
- `jobs`: async analysis/report tasks

## 4. Tech Stack
- Python 3.12+
- FastAPI + Uvicorn
- Pydantic v2
- SQLAlchemy 2 + Alembic
- PostgreSQL 15+
- FastAPI BackgroundTasks and/or APScheduler
- FastAPI Cache (optional, targeted endpoints)
- Pytest + httpx TestClient
- OpenTelemetry + structured logging (JSON)

## 5. Service Modules
- `auth`: registration, login, refresh, RBAC
- `workspaces`: teams, memberships, role management
- `projects`: project container for surveys
- `surveys`: generation, editing, publishing
- `responses`: respondent submissions + validation
- `insights`: sentiment/theme/recommendation summaries
- `reports`: export job lifecycle
- `analytics`: KPI metrics and usage events

## 6. AI Orchestration
Provider abstraction:
- `LLMClient` interface to avoid lock-in
- Per-task prompt templates with version tags

AI tasks:
- `generate_questions(goal, audience, tone, constraints)`
- `detect_bias(questions)`
- `analyze_responses(survey_id, responses_batch)`
- `build_personas(insights_bundle)`
- `generate_report_outline(insights_bundle)`

Guardrails:
- JSON schema-enforced AI outputs
- Retry policy with backoff
- Fallback model path
- Output moderation/PII redaction hooks

## 7. Data Model (high level)
Core entities:
- User, Workspace, WorkspaceMember
- Project
- Survey, SurveyQuestion, QuestionOption
- SurveyPublication
- SurveyResponse, ResponseAnswer
- InsightRun, InsightSummary, InsightTheme, InsightRecommendation, Persona
- ReportJob, ExportAsset
- AuditEvent, MetricSnapshot

State machines:
- Survey: `draft -> published -> closed|archived`
- InsightRun: `queued -> running -> completed|failed`
- ReportJob: `queued -> running -> completed|failed`

## 8. Security and Compliance
- JWT access + refresh token rotation
- Password hashing with Argon2/Bcrypt
- RBAC at workspace/project/survey levels
- Public endpoints scoped by survey token/slug
- Rate limiting on auth + public submit endpoints
- Audit trail for publish, export, membership changes
- Data retention policy for responses and exports

## 9. Performance Targets (MVP SLO)
- P95 API latency (non-AI sync endpoints): < 300ms
- Survey generation request ack: < 800ms (async job accepted)
- Insight completion for <=500 responses: < 2 minutes
- API availability target: 99.5%

## 10. Observability
- Request ID correlation across API + background jobs
- Structured logs with user/workspace/survey context
- Metrics: request count/latency, background job duration/failure, AI errors
- Alerts: high failure rate, backlog threshold, provider timeout spikes

## 11. Environments and CI/CD
Environments:
- local, staging, production

CI gates:
- lint/type/test required
- migration check
- OpenAPI schema diff check

Deployment:
- Containerized API service (single deployable for MVP)
- Rolling deploy with health checks
- Backward-compatible DB migrations only

## 12. Testing Strategy
- Unit tests: service rules + validation
- Integration tests: API with test DB and background-task stubs
- Contract tests: FE-consumed schemas and examples
- Async job tests: insight/report pipelines
- Smoke tests: sign-in -> generate -> publish -> respond -> insights

## 13. API Versioning and Change Control
- Base path `/api/v1`
- Non-breaking additive changes allowed in same version
- Breaking changes require `/api/v2`
- Docs updates required in:
  - `03-full-route-spec.md`
  - `04-schema-contracts.md`
  - `05-screen-specification.md`

## 14. Scale-Up Path (Post-MVP)
- Trigger condition examples:
  - sustained insight/report processing delays
  - increased concurrent workload causing API contention
  - reliability requirements for guaranteed job retries
- Planned migration path:
  - introduce Redis as broker/cache layer
  - move long-running jobs to Celery workers
  - preserve API contracts and job status schemas

## 15. Open Questions
- Billing implementation timeline for monetization tiers
- Voice-to-survey engine ownership (backend vs separate service)
- Persona generation depth expected for MVP
