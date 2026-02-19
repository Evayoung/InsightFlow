# InsightFlow Full Route Spec (v1)

Base URL: `/api/v1`  
Auth: `Bearer <access_token>` unless explicitly public  
Content-Type: `application/json`

## 1. Health and Meta
1. `GET /health` (public)
- Purpose: liveness probe
- Response: `200 {"status":"ok"}`

2. `GET /ready` (public)
- Purpose: readiness probe (db/scheduler/provider checks)
- Response: `200 {"status":"ready","checks":{...}}` or `503`

3. `GET /meta` (public)
- Purpose: service version/build info
- Response: `200 {"service":"insightflow-backend","version":"x.y.z"}`

## 2. Auth
1. `POST /auth/register`
- Create user account
- Body: `RegisterRequest`
- Response: `201 AuthSession`

2. `POST /auth/login`
- Login with email/password
- Body: `LoginRequest`
- Response: `200 AuthSession`

3. `POST /auth/refresh`
- Rotate access token
- Body: `RefreshRequest`
- Response: `200 TokenPair`

4. `POST /auth/logout`
- Invalidate refresh token/session
- Body: `LogoutRequest`
- Response: `204`

5. `GET /auth/me`
- Current user profile
- Response: `200 UserProfile`

## 3. Workspaces and Members
1. `POST /workspaces`
- Create workspace
- Body: `WorkspaceCreateRequest`
- Response: `201 Workspace`

2. `GET /workspaces`
- List user workspaces
- Response: `200 WorkspaceList`

3. `GET /workspaces/{workspace_id}`
- Get workspace detail
- Response: `200 Workspace`

4. `PATCH /workspaces/{workspace_id}`
- Update workspace settings/name
- Body: `WorkspaceUpdateRequest`
- Response: `200 Workspace`

5. `POST /workspaces/{workspace_id}/members/invite`
- Invite member
- Body: `MemberInviteRequest`
- Response: `201 WorkspaceMember`

6. `GET /workspaces/{workspace_id}/members`
- List members
- Response: `200 WorkspaceMemberList`

7. `PATCH /workspaces/{workspace_id}/members/{member_id}`
- Change role/status
- Body: `MemberUpdateRequest`
- Response: `200 WorkspaceMember`

8. `DELETE /workspaces/{workspace_id}/members/{member_id}`
- Remove member
- Response: `204`

## 4. Projects
1. `POST /workspaces/{workspace_id}/projects`
- Create project
- Body: `ProjectCreateRequest`
- Response: `201 Project`

2. `GET /workspaces/{workspace_id}/projects`
- List projects
- Query: `cursor`, `limit`, `status`
- Response: `200 ProjectList`

3. `GET /projects/{project_id}`
- Get project detail
- Response: `200 Project`

4. `PATCH /projects/{project_id}`
- Update project
- Body: `ProjectUpdateRequest`
- Response: `200 Project`

5. `DELETE /projects/{project_id}`
- Archive project
- Response: `204`

## 5. Surveys (Authoring)
1. `POST /projects/{project_id}/surveys`
- Create empty draft survey
- Body: `SurveyCreateRequest`
- Response: `201 Survey`

2. `GET /projects/{project_id}/surveys`
- List surveys
- Query: `status`, `cursor`, `limit`
- Response: `200 SurveyList`

3. `GET /surveys/{survey_id}`
- Get survey detail with questions
- Response: `200 SurveyDetail`

4. `PATCH /surveys/{survey_id}`
- Update survey metadata
- Body: `SurveyUpdateRequest`
- Response: `200 Survey`

5. `POST /surveys/{survey_id}/ai-generate`
- Generate survey questions from goal/context
- Body: `SurveyGenerateRequest`
- Response: `202 JobAccepted` (async) or `200 SurveyQuestionsBundle`

6. `POST /surveys/{survey_id}/bias-check`
- Check bias/clarity for draft questions
- Body: `BiasCheckRequest`
- Response: `200 BiasCheckResult`

7. `POST /surveys/{survey_id}/questions`
- Add question
- Body: `QuestionCreateRequest`
- Response: `201 Question`

8. `PATCH /surveys/{survey_id}/questions/{question_id}`
- Update question
- Body: `QuestionUpdateRequest`
- Response: `200 Question`

9. `DELETE /surveys/{survey_id}/questions/{question_id}`
- Delete question
- Response: `204`

10. `POST /surveys/{survey_id}/publish`
- Publish draft survey
- Body: `SurveyPublishRequest`
- Response: `200 SurveyPublication`

11. `POST /surveys/{survey_id}/close`
- Close active survey
- Response: `200 Survey`

12. `POST /surveys/{survey_id}/archive`
- Archive survey
- Response: `200 Survey`

## 6. Public Respondent Routes
1. `GET /public/surveys/{public_slug}`
- Fetch published survey form definition
- Response: `200 PublicSurveyDetail`

2. `POST /public/surveys/{public_slug}/responses`
- Submit response
- Body: `PublicResponseSubmitRequest`
- Response: `201 ResponseAccepted`

3. `GET /public/surveys/{public_slug}/status`
- Optional status endpoint for closed/active
- Response: `200 {"status":"active|closed"}`

## 7. Responses (Owner Side)
1. `GET /surveys/{survey_id}/responses`
- List raw responses (paginated)
- Query: `cursor`, `limit`, `from`, `to`
- Response: `200 SurveyResponseList`

2. `GET /surveys/{survey_id}/responses/{response_id}`
- Get a single response
- Response: `200 SurveyResponse`

3. `POST /surveys/{survey_id}/responses/import`
- CSV/JSON import for historical data
- Body: `ResponseImportRequest`
- Response: `202 JobAccepted`

## 8. Insights and Personas
1. `POST /surveys/{survey_id}/insights/run`
- Trigger analysis job
- Body: `InsightsRunRequest`
- Response: `202 InsightRunAccepted`

2. `GET /surveys/{survey_id}/insights/latest`
- Get latest completed insights
- Response: `200 InsightBundle`

3. `GET /surveys/{survey_id}/insights/runs/{run_id}`
- Get run state and output if complete
- Response: `200 InsightRunDetail`

4. `POST /surveys/{survey_id}/personas/generate`
- Generate personas from insight bundle
- Body: `PersonaGenerateRequest`
- Response: `202 JobAccepted` or `200 PersonaList`

5. `GET /surveys/{survey_id}/personas`
- List generated personas
- Response: `200 PersonaList`

## 9. Reports and Exports
1. `POST /surveys/{survey_id}/reports`
- Create export job (pdf/slides)
- Body: `ReportCreateRequest`
- Response: `202 ReportJobAccepted`

2. `GET /surveys/{survey_id}/reports`
- List report jobs/assets
- Response: `200 ReportJobList`

3. `GET /surveys/{survey_id}/reports/{report_id}`
- Report job detail
- Response: `200 ReportJobDetail`

4. `GET /exports/{asset_id}/download`
- Download signed URL or stream
- Response: `302` or `200 binary`

## 10. Analytics and Metrics
1. `GET /workspaces/{workspace_id}/analytics/overview`
- Dashboard metrics
- Query: `from`, `to`
- Response: `200 AnalyticsOverview`

2. `GET /surveys/{survey_id}/analytics/completion`
- Completion stats (generated/completed)
- Response: `200 CompletionMetric`

3. `POST /events/track`
- Internal event ingestion (optional)
- Body: `TrackEventRequest`
- Response: `202`

## 11. Notifications (optional MVP+)
1. `POST /notifications/webhooks/test`
- Validate webhook destination
- Body: `WebhookTestRequest`
- Response: `200`

2. `POST /notifications/subscriptions`
- Create subscription
- Body: `NotificationSubscriptionRequest`
- Response: `201`

## 12. Common Errors
- `400` Validation error
- `401` Unauthorized
- `403` Forbidden
- `404` Not found
- `409` Conflict (invalid state transitions)
- `422` Unprocessable (schema/business rule)
- `429` Rate-limited
- `500` Internal error
- `502/504` upstream AI provider failure/timeout

Error envelope:
```json
{
  "error": {
    "code": "SURVEY_NOT_PUBLISHED",
    "message": "Survey is not currently accepting responses.",
    "request_id": "req_123"
  }
}
```

## 13. Idempotency and Pagination
- Idempotency header supported on create/trigger endpoints:
  - `Idempotency-Key: <uuid>`
- Pagination:
  - Request: `?cursor=<opaque>&limit=50`
  - Response includes `next_cursor`

## 14. Route-to-PRD Mapping
- AI survey generation: `/ai-generate`
- Bias detection: `/bias-check`
- Response analysis/summary: `/insights/*`
- Persona builder: `/personas/*`
- Export report: `/reports` and `/exports/*`
