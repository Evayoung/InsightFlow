# InsightFlow Backend

FastAPI backend for InsightFlow.

Current implementation covers:
- Phase 0: foundation/auth/db bootstrapping
- Phase 1: survey authoring core
- Phase 2: responses, insights, personas, completion analytics
- Phase 3: reporting/export + hardening (audit/events/rate limiting)

## Implemented Features
- FastAPI application bootstrap (`app/main.py`)
- Core public routes: `/health`, `/ready`, `/meta`
- API versioning root: `/api/v1`
- Auth:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/reset/verify`
  - `POST /api/v1/auth/password/reset`
  - `GET /api/v1/auth/me`
- Workspaces/Projects (role-guarded):
  - `POST /api/v1/workspaces`
  - `GET /api/v1/workspaces`
  - `POST /api/v1/workspaces/{workspace_id}/projects`
  - `GET /api/v1/workspaces/{workspace_id}/projects`
- Surveys:
  - create/list/get/update survey
  - add/update/delete questions
  - AI generate: `POST /api/v1/surveys/{survey_id}/ai-generate`
  - bias check: `POST /api/v1/surveys/{survey_id}/bias-check`
  - publish/close/archive
  - public fetch: `GET /api/v1/public/surveys/{public_slug}`
- Feedback and insights:
  - public submit: `POST /api/v1/public/surveys/{public_slug}/responses`
  - list/get responses
  - run insights / latest insights / run detail
  - generate/list personas
  - completion metric
- Reporting and hardening:
  - create/list/get report jobs
  - download export asset via token
  - track usage events
  - audit + usage event persistence
  - public endpoint in-memory rate limiting
- Alembic migrations through Phase 3
- Test suite covering auth/workspaces/projects/surveys/phase2/phase3 flows

## Setup
1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -e .[dev]`
3. Copy env file:
   - `.env.example` -> `.env`
4. Run migrations:
   - `alembic upgrade head`
5. Start the server:
   - `python run_server.py`

## Environment Variables
- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAILS_FROM_EMAIL`
- `BACKEND_CORS_ORIGINS`
- `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL_PRIMARY`, `GROQ_MODEL_FALLBACK`, `GROQ_TIMEOUT_SECONDS`
- `PUBLIC_RATE_LIMIT_REQUESTS`, `PUBLIC_RATE_LIMIT_WINDOW_SECONDS`
- `REPORT_EXPORT_DIR`, `REPORT_DOWNLOAD_TOKEN_EXPIRE_MINUTES`

## Run Tests
- `pytest -q`

## Notes
- Current async strategy follows MVP decision: no Redis/Celery/broker.
- Background execution uses FastAPI `BackgroundTasks` for insights and report jobs.
