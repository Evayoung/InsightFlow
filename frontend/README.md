# InsightFlow Frontend

This frontend remains plain HTML, CSS, and JavaScript by design, but it now uses shared assets and a single API runtime instead of duplicating the same shell logic in every page.

## Structure

- `assets/styles/app.css`
  - Shared design tokens, layout, components, sidebar shell, modal styles, toast styles, and responsive rules.
- `assets/js/common.js`
  - Shared API client, token refresh handling, workspace switcher, sidebar shell, toasts, modal helpers, report downloads, and synthetic workspace analytics/activity helpers.
- `pages/`
  - Authenticated application screens.
  - Includes `survey-editor.html` for manual and AI-assisted survey authoring.
- `public-survey.html`
  - Public response page for published surveys.
- `reset-password.html`
  - Password reset verification and submission flow.
- `index.html`
  - Redirects to the sign-in page.

## Important Notes

- The backend remains FastAPI JSON API-first. We are not switching to HTMX or server-rendered templates.
- Workspace analytics on the frontend are derived from existing backend endpoints, since there is no dedicated workspace analytics endpoint in the API.
- The events page now uses a synthesized activity feed built from projects, surveys, and reports because the backend does not currently expose an events listing endpoint.
- Report downloads use the export token returned by the backend report contract.
- Public survey links should use `public-survey.html?slug=...` for this static frontend layout.

## Current Expectations

- Serve the `frontend/` directory as static files.
- The authenticated pages expect the backend API at `window.location.origin + /api/v1` by default.
- A custom backend origin can be saved from the settings screen via `if_api_url` in `localStorage`.

## Current Authoring Flow

- `New Survey`
  - Creates a manual draft and redirects into the survey editor.
- `AI Generate`
  - Creates a draft, runs AI question generation, and opens the survey editor with generated questions ready for review.
- `survey-editor.html`
  - Supports metadata editing, manual question CRUD, AI regeneration, bias review, and publish/share flow.
