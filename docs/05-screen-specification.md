# InsightFlow Screen Specification (Source of Truth)

Purpose:
- Define frontend screens and the exact backend contracts each screen consumes.
- Keep FE and BE aligned on behavior, states, and API dependencies.

## 1. Authentication
### Screen: Sign Up
- User goal: create account
- Inputs: `full_name`, `email`, `password`
- API: `POST /auth/register`
- Success: store tokens, route to workspace onboarding
- Errors: email exists, weak password, validation

### Screen: Login
- Inputs: `email`, `password`
- API: `POST /auth/login`
- Success: route dashboard
- Errors: invalid credentials, rate limit

## 2. Workspace and Project Setup
### Screen: Workspace Onboarding
- Inputs: workspace name, optional invite emails
- APIs:
  - `POST /workspaces`
  - `POST /workspaces/{workspace_id}/members/invite`
- Success state: workspace created with owner role

### Screen: Project List
- Data: projects in selected workspace
- API: `GET /workspaces/{workspace_id}/projects`
- Actions:
  - create project: `POST /workspaces/{workspace_id}/projects`
  - open project detail

## 3. Dashboard (PRD wireframe item)
### Screen: Dashboard Home
- Core UI:
  - "Describe your goal" input
  - recent surveys
  - completion KPI card
- APIs:
  - `GET /workspaces/{workspace_id}/analytics/overview`
  - `GET /workspaces/{workspace_id}/projects`
- CTA:
  - create survey draft and trigger generation

## 4. Survey Builder
### Screen: Create Survey from Goal
- Inputs:
  - survey title
  - goal description
  - target audience
  - question count
- APIs:
  - `POST /projects/{project_id}/surveys`
  - `POST /surveys/{survey_id}/ai-generate`
- Loading state:
  - poll job/run status if async (`JobAccepted`)

### Screen: Survey Editor
- Data:
  - question list with order and type
- APIs:
  - `GET /surveys/{survey_id}`
  - `POST /surveys/{survey_id}/questions`
  - `PATCH /surveys/{survey_id}/questions/{question_id}`
  - `DELETE /surveys/{survey_id}/questions/{question_id}`
- Actions:
  - manual edits
  - reorder questions (same update endpoint with order)

### Screen: Bias Review Panel
- Trigger: "Check Bias"
- APIs:
  - `POST /surveys/{survey_id}/bias-check`
- UI output:
  - flagged questions
  - severity badges
  - one-click apply suggested rewrite

### Screen: Publish Survey
- APIs:
  - `POST /surveys/{survey_id}/publish`
- Output:
  - public link (`public_slug`)
  - status = `published`

## 5. Respondent Experience (Public)
### Screen: Public Survey Form
- Route: `/public/surveys/{public_slug}`
- APIs:
  - `GET /public/surveys/{public_slug}`
  - `POST /public/surveys/{public_slug}/responses`
- UI states:
  - active form
  - closed survey message
  - submit success confirmation

## 6. Insights and Analytics
### Screen: Insights Summary
- Must show:
  - plain-language overview
  - sentiment distribution
  - themes
  - recommendations
- APIs:
  - `POST /surveys/{survey_id}/insights/run` (manual trigger if needed)
  - `GET /surveys/{survey_id}/insights/latest`
  - `GET /surveys/{survey_id}/insights/runs/{run_id}` (if pending/running)

### Screen: Response Explorer
- Data table/filter for raw responses
- API:
  - `GET /surveys/{survey_id}/responses`
  - `GET /surveys/{survey_id}/responses/{response_id}`

### Screen: Completion KPI
- KPI = `completed_ai_surveys / total_generated_surveys * 100`
- API:
  - `GET /surveys/{survey_id}/analytics/completion`

## 7. Persona Builder
### Screen: Personas
- Actions:
  - generate personas
  - view persona cards
- APIs:
  - `POST /surveys/{survey_id}/personas/generate`
  - `GET /surveys/{survey_id}/personas`

## 8. Export and Share
### Screen: Export Report
- Options:
  - format (`pdf` or `slides`)
  - section toggles
- APIs:
  - `POST /surveys/{survey_id}/reports`
  - `GET /surveys/{survey_id}/reports/{report_id}`
  - `GET /exports/{asset_id}/download`
- State handling:
  - queued/running/progress/completed/failed

## 9. Team Collaboration (Should-have)
### Screen: Team Members
- APIs:
  - `GET /workspaces/{workspace_id}/members`
  - `POST /workspaces/{workspace_id}/members/invite`
  - `PATCH /workspaces/{workspace_id}/members/{member_id}`
  - `DELETE /workspaces/{workspace_id}/members/{member_id}`

## 10. Cross-Screen UX/Contract Rules
- All protected screens require valid access token.
- On `401`, frontend should attempt `POST /auth/refresh` once.
- For async operations, frontend must support `queued/running/completed/failed`.
- Error surface must map to `ApiError.error.code`.
- Date displays should parse UTC timestamps from API as local time.

## 11. Acceptance Mapping (from PRD)
- User describes goal and gets generated survey:
  - Covered by Create Survey + Survey Editor screens.
- User edits/approves then publishes:
  - Covered by Survey Editor + Publish Survey screens.
- AI analyzes responses and gives plain-language summary:
  - Covered by Insights Summary screen.
- AI detects biased questions and suggests rewrites:
  - Covered by Bias Review panel.
- Visual report export:
  - Covered by Export Report screen.
