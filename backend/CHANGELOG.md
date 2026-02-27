## 0.1.0 - 2026-02-27

- Bootstrapped FastAPI backend structure and app factory.
- Added health/readiness/meta endpoints.
- Added `/api/v1` auth skeleton endpoints with JWT flow.
- Added SQLAlchemy models for `users`, `workspaces`, `workspace_members`, and `projects`.
- Added Alembic configuration and initial foundation migration.
- Added baseline pytest coverage for health/meta/auth.

## 0.2.0 - 2026-02-27

- Completed Phase 1 survey authoring core:
  - survey, question, option, publication models and migration
  - survey authoring endpoints, AI question generation, bias analysis
  - survey publish/close/archive flow and public survey read endpoint
- Added Groq LLM provider client with primary/fallback model support.
- Added workspace/project role-guarded API coverage and tests.

## 0.3.0 - 2026-02-27

- Completed Phase 2 response and insight core:
  - public response submission with validation
  - response retrieval endpoints
  - insight run lifecycle and latest insight retrieval
  - persona generation/listing endpoints
  - completion metric endpoint
- Added feedback/insight/persona persistence models and migration.

## 0.4.0 - 2026-02-27

- Completed Phase 3 reporting and hardening:
  - report generation endpoints and export asset download flow
  - audit and usage event logging models/services
  - public endpoint in-memory rate limiting
  - reporting/events migration and tests
- Added export artifact ignore rule (`generated_reports/`).
