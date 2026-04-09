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

## 0.4.1 - 2026-04-08

- Integrated the static frontend into FastAPI for immediate local end-to-end testing.
- Added clean public routes for:
  - `/`
  - `/public/surveys/{public_slug}`
  - `/reset-password`
- Documented the single-server local testing flow in the backend README.

## 0.4.2 - 2026-04-08

- Added survey authoring guardrails:
  - prevent publishing surveys with zero questions
  - replace existing draft questions during AI regeneration instead of duplicating them
- Enriched survey responses with publish metadata for frontend sharing/editor flows.
- Added backend test coverage for publish guard and AI question replacement behavior.

## 0.4.3 - 2026-04-08

- Added branded SMTP email delivery for:
  - welcome/account-created emails on registration
  - password reset emails
- Switched auth email delivery to multipart text + HTML messages.
- Added auth test coverage to verify welcome and password-reset emails are triggered.
- Updated local/frontend URL configuration defaults for single-server FastAPI + frontend flow.

## 0.4.4 - 2026-04-09

- Added branded workspace invitation emails for existing users invited into a workspace.
- Added SMTP transport mode configuration for `STARTTLS` and `SSL`.
- Improved email delivery diagnostics and logging for SMTP failures.
- Added workspace invitation email test coverage.

## 0.4.5 - 2026-04-09

- Added pending workspace invitations for emails that are not yet registered.
- Updated workspace invite flow so unknown emails no longer fail with `404 User not found`.
- Added automatic invitation claiming during signup when a matching invited email registers.
- Extended workspace member listing/removal to include pending invitations.
