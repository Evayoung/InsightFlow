## 0.1.0 - 2026-02-27

- Bootstrapped FastAPI backend structure and app factory.
- Added health/readiness/meta endpoints.
- Added `/api/v1` auth skeleton endpoints with JWT flow.
- Added SQLAlchemy models for `users`, `workspaces`, `workspace_members`, and `projects`.
- Added Alembic configuration and initial foundation migration.
- Added baseline pytest coverage for health/meta/auth.
