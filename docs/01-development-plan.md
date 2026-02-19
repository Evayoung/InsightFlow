# InsightFlow Backend Development Plan (FastAPI)

## 1. Scope
This plan covers backend delivery for the PRD and serves as the execution plan for the FastAPI team.

MVP architecture decision:
- Do not use Redis, Celery, or any broker in MVP.
- Use FastAPI in-process background tasks and/or APScheduler for async workflows.
- Use FastAPI Cache only where needed for low-cost performance gains.
- Revisit brokered architecture only when traffic/latency thresholds justify it.

MVP must-have capabilities:
- AI survey generation from user goal
- Bias detection and neutral reword suggestions
- Survey publish/share lifecycle
- Response collection
- AI analysis: sentiment, themes, summary, recommendations
- Export-ready report payloads (PDF/slide generation hook)

Should-have in this cycle:
- Team collaboration basics (workspace + role membership)
- Usage analytics and completion-rate KPI tracking

Out of scope for MVP:
- Offline survey mode
- Slack/Notion integrations
- Full multilingual pipeline
- Advanced enterprise billing engine

## 2. Delivery Phases

## Phase 0: Foundations (Week 1)
- Initialize backend project structure under `backend/`
- Set up FastAPI app, dependency injection, and settings management
- Add Postgres + SQLAlchemy/Alembic stack
- Add OpenAI provider adapter and background execution strategy (FastAPI BackgroundTasks/APScheduler)
- Implement auth (JWT + refresh), workspace membership, role guards
- Define API versioning pattern (`/api/v1`)

Exit criteria:
- App boots locally with health/readiness checks
- DB migrations run
- Auth-protected test endpoint works

## Phase 1: Survey Authoring Core (Week 2)
- Create survey domain models (project, survey, question, option)
- Build AI generate endpoint from goal
- Build bias analysis endpoint for drafted questions
- Build survey draft edit/update/publish endpoints
- Build public respondent form read endpoint

Exit criteria:
- PM can generate survey, edit, publish
- Public respondent can fetch published survey definition

## Phase 2: Response + Insights Core (Week 3)
- Implement response submit endpoint with validation
- Add async analysis pipeline (sentiment + theme extraction + summary)
- Add insights retrieval endpoint
- Track survey completion metrics (generated vs completed)
- Add persona builder first-pass endpoint from analyzed responses

Exit criteria:
- Submitted responses trigger analysis job
- Owner sees summary/recommendations and KPIs

## Phase 3: Reporting + Hardening (Week 4)
- Add report generation endpoint (PDF/slide job + downloadable asset URL)
- Add audit events and usage logging
- Add rate limits and abuse controls on public endpoints
- Add test coverage (unit + integration + smoke)
- Add OpenAPI docs review with frontend team

Exit criteria:
- End-to-end user flow works per PRD
- Docs in `docs/` accepted as source-of-truth by FE/BE

## 3. Workstreams
- API & domain modeling
- AI orchestration and prompt contracts
- Async jobs and report pipeline
- Security/compliance
- Observability and QA

## 4. Team Roles (recommended)
- Backend lead: architecture + quality gates
- API engineer: CRUD, auth, contracts
- AI engineer: prompt pipelines, model evaluation
- Platform engineer: infra, CI/CD, monitoring
- QA engineer: test strategy and release signoff

## 5. Technical Milestones
- M1: Running FastAPI service with auth and DB migrations
- M2: Survey generation + publish live
- M3: Insights generation and KPI tracking live
- M4: Export report and production-readiness complete

## 6. Risks and Mitigations
- AI output inconsistency: enforce strict response schemas + retries + fallbacks
- Prompt drift/regressions: version prompts and run snapshot tests
- Slow analysis latency: run non-blocking background jobs and return job states; introduce broker only if required
- Public survey abuse: CAPTCHA/rate limit/IP throttling
- Ambiguous PRD gaps: lock this docs set as contract and change-control updates

## 7. Definition of Done (MVP)
- All must-have PRD features represented by live endpoints
- Contract tests pass for all schemas in `04-schema-contracts.md`
- Route behavior matches `03-full-route-spec.md`
- Screen API needs from `05-screen-specification.md` are satisfied
- Changelog and release notes updated in backend
