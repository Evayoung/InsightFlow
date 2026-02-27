# InsightFlow Backend

Phase 0 foundation for the InsightFlow FastAPI backend.

## Implemented Baseline
- FastAPI application bootstrap (`app/main.py`)
- Core public routes: `/health`, `/ready`, `/meta`
- API versioning root: `/api/v1`
- Auth skeleton:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
- SQLAlchemy models:
  - `users`
  - `workspaces`
  - `workspace_members`
  - `projects`
- Alembic setup + initial migration
- Pytest smoke coverage for health/meta/auth flow

## Setup
1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -e .[dev]`
3. Copy env file:
   - `.env.example` -> `.env`
4. Run migrations:
   - `alembic upgrade head`
5. Start the server:
   - `uvicorn app.main:app --reload --port 8000`

## Environment Variables
- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`

## Run Tests
- `pytest -q`

## Notes
- Current async strategy follows MVP decision: no Redis/Celery/broker.
- Background execution will use FastAPI `BackgroundTasks` and/or APScheduler in upcoming modules.
