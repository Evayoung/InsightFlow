# InsightFlow Complete Schema Contracts (v1)

Contract style:
- Types are canonical and map directly to FastAPI/Pydantic models.
- Time fields are ISO-8601 UTC strings.
- IDs use string UUID format unless stated otherwise.

## 1. Shared Primitives
```json
{
  "Id": "string(uuid)",
  "DateTime": "string(date-time)",
  "Url": "string(uri)",
  "Email": "string(email)",
  "Cursor": "string",
  "Money": { "amount": "number", "currency": "string(ISO-4217)" }
}
```

## 2. Enums
```json
{
  "WorkspaceRole": ["owner", "admin", "editor", "viewer"],
  "ProjectStatus": ["active", "archived"],
  "SurveyStatus": ["draft", "published", "closed", "archived"],
  "QuestionType": ["single_choice", "multi_choice", "rating", "text", "nps", "yes_no"],
  "BiasSeverity": ["low", "medium", "high"],
  "InsightRunStatus": ["queued", "running", "completed", "failed"],
  "ReportStatus": ["queued", "running", "completed", "failed"],
  "SentimentLabel": ["positive", "neutral", "negative"],
  "PersonaConfidence": ["low", "medium", "high"]
}
```

## 3. Auth Contracts
### RegisterRequest
```json
{
  "email": "user@example.com",
  "password": "string(min:8)",
  "full_name": "string"
}
```

### LoginRequest
```json
{ "email": "user@example.com", "password": "string" }
```

### TokenPair
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### AuthSession
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "string",
    "created_at": "2026-02-19T10:00:00Z"
  },
  "tokens": {
    "access_token": "string",
    "refresh_token": "string",
    "token_type": "bearer",
    "expires_in": 3600
  }
}
```

## 4. Workspace and Project
### Workspace
```json
{
  "id": "uuid",
  "name": "string",
  "owner_id": "uuid",
  "created_at": "date-time",
  "updated_at": "date-time"
}
```

### WorkspaceMember
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "email": "member@example.com",
  "role": "editor",
  "status": "active",
  "invited_at": "date-time",
  "joined_at": "date-time|null"
}
```

### Project
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "name": "string",
  "description": "string|null",
  "status": "active",
  "created_by": "uuid",
  "created_at": "date-time",
  "updated_at": "date-time"
}
```

## 5. Survey Authoring
### Survey
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "title": "string",
  "goal": "string",
  "target_audience": "string|null",
  "status": "draft",
  "language": "en",
  "created_by": "uuid",
  "created_at": "date-time",
  "updated_at": "date-time"
}
```

### QuestionOption
```json
{
  "id": "uuid",
  "label": "string",
  "value": "string",
  "order": 1
}
```

### Question
```json
{
  "id": "uuid",
  "survey_id": "uuid",
  "type": "single_choice",
  "text": "string",
  "description": "string|null",
  "required": true,
  "order": 1,
  "options": [
    { "id": "uuid", "label": "Very satisfied", "value": "very_satisfied", "order": 1 }
  ],
  "meta": {
    "scale_min": 1,
    "scale_max": 5
  }
}
```

### SurveyDetail
```json
{
  "survey": { "id": "uuid", "project_id": "uuid", "title": "string", "goal": "string", "status": "draft" },
  "questions": [
    { "id": "uuid", "survey_id": "uuid", "type": "text", "text": "What is confusing about pricing?", "required": false, "order": 1, "options": [] }
  ]
}
```

### SurveyGenerateRequest
```json
{
  "goal": "Validate new feature onboarding experience",
  "target_audience": "new users in first 7 days",
  "question_count": 10,
  "tone": "neutral",
  "constraints": ["avoid jargon", "mobile friendly"]
}
```

### SurveyQuestionsBundle
```json
{
  "questions": [
    { "type": "text", "text": "What was hardest during onboarding?", "required": true, "order": 1, "options": [] }
  ],
  "generation_meta": {
    "model": "gpt-x",
    "prompt_version": "survey_gen_v1",
    "generated_at": "date-time"
  }
}
```

## 6. Bias Detection
### BiasCheckRequest
```json
{
  "questions": [
    { "id": "uuid", "text": "Do you agree our new pricing is great?" }
  ]
}
```

### BiasIssue
```json
{
  "question_id": "uuid",
  "severity": "high",
  "reason": "leading language",
  "suggested_rewrite": "How would you rate your understanding of the new pricing?"
}
```

### BiasCheckResult
```json
{
  "issues": [
    {
      "question_id": "uuid",
      "severity": "high",
      "reason": "leading language",
      "suggested_rewrite": "How would you rate your understanding of the new pricing?"
    }
  ],
  "summary": { "total_questions": 10, "flagged_questions": 2 }
}
```

## 7. Publication and Public Form
### SurveyPublication
```json
{
  "survey_id": "uuid",
  "public_slug": "string",
  "status": "published",
  "published_at": "date-time",
  "close_at": "date-time|null"
}
```

### PublicSurveyDetail
```json
{
  "survey": {
    "id": "uuid",
    "title": "string",
    "description": "string|null"
  },
  "questions": [
    { "id": "uuid", "type": "single_choice", "text": "How clear was onboarding?", "required": true, "order": 1, "options": [{ "id": "uuid", "label": "Clear", "value": "clear", "order": 1 }] }
  ]
}
```

## 8. Responses
### PublicResponseSubmitRequest
```json
{
  "answers": [
    { "question_id": "uuid", "value": "clear" },
    { "question_id": "uuid", "value": "Pricing page was confusing." }
  ],
  "respondent_meta": {
    "source": "email_campaign",
    "locale": "en-US"
  }
}
```

### SurveyResponse
```json
{
  "id": "uuid",
  "survey_id": "uuid",
  "submitted_at": "date-time",
  "answers": [
    { "question_id": "uuid", "value": "clear" }
  ],
  "respondent_meta": {
    "source": "public_link",
    "locale": "en-US"
  }
}
```

### ResponseAccepted
```json
{
  "response_id": "uuid",
  "survey_id": "uuid",
  "status": "accepted",
  "submitted_at": "date-time"
}
```

## 9. Insights and Personas
### InsightTheme
```json
{
  "id": "uuid",
  "label": "pricing confusion",
  "count": 37,
  "sample_quotes": ["Users say pricing tiers are unclear."],
  "sentiment": "negative"
}
```

### InsightRecommendation
```json
{
  "id": "uuid",
  "title": "Clarify pricing tiers on landing page",
  "detail": "Add side-by-side comparison and onboarding tooltip.",
  "priority": "high",
  "expected_impact": "reduce onboarding drop-off"
}
```

### InsightSummary
```json
{
  "survey_id": "uuid",
  "run_id": "uuid",
  "overview": "Most users understand onboarding flow, but pricing remains confusing.",
  "sentiment_distribution": {
    "positive": 0.38,
    "neutral": 0.29,
    "negative": 0.33
  },
  "themes": [
    { "id": "uuid", "label": "pricing confusion", "count": 37, "sample_quotes": ["Users say pricing tiers are unclear."], "sentiment": "negative" }
  ],
  "recommendations": [
    { "id": "uuid", "title": "Clarify pricing tiers on landing page", "detail": "Add side-by-side comparison and onboarding tooltip.", "priority": "high", "expected_impact": "reduce onboarding drop-off" }
  ],
  "generated_at": "date-time"
}
```

### Persona
```json
{
  "id": "uuid",
  "survey_id": "uuid",
  "name": "Cost-Conscious Explorer",
  "summary": "Wants clear value before committing.",
  "key_traits": ["price-sensitive", "high-comparison behavior"],
  "frustrations": ["unclear tier differences"],
  "goals": ["quickly identify best plan"],
  "confidence": "medium"
}
```

## 10. Reports and Exports
### ReportCreateRequest
```json
{
  "format": "pdf",
  "template": "executive_summary",
  "include_sections": ["overview", "themes", "recommendations", "personas"]
}
```

### ReportJobDetail
```json
{
  "id": "uuid",
  "survey_id": "uuid",
  "status": "completed",
  "format": "pdf",
  "created_at": "date-time",
  "completed_at": "date-time|null",
  "asset": {
    "asset_id": "uuid",
    "download_url": "https://...",
    "expires_at": "date-time"
  },
  "error": null
}
```

## 11. Jobs and Generic Responses
### JobAccepted
```json
{
  "job_id": "uuid",
  "status": "queued",
  "accepted_at": "date-time"
}
```

### PaginatedResponse<T>
```json
{
  "items": [],
  "next_cursor": "string|null",
  "count": 50
}
```

### ApiError
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "request_id": "string"
  }
}
```

## 12. Validation Rules
- `question_count` range: `3..30`
- Survey title length: `3..140`
- Option count for choice questions: `2..12`
- Public response payload max size: `200KB`
- One response per `(survey_id, respondent_fingerprint)` if duplicate protection enabled

## 13. Contract Ownership
- Backend owns canonical schema changes.
- Any contract change requires updates in:
  - `03-full-route-spec.md`
  - `04-schema-contracts.md`
  - Frontend typed client generation output
