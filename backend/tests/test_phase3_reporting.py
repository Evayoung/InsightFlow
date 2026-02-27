from app.api.v1.endpoints.surveys import get_llm_dep
from app.core.config import settings


class FakeLLM:
    def generate_json(self, **kwargs):
        return {
            "questions": [
                {"type": "text", "text": "What did you like?", "required": True, "order": 1, "options": []},
                {"type": "text", "text": "What should improve?", "required": False, "order": 2, "options": []},
                {"type": "rating", "text": "Rate your experience", "required": True, "order": 3, "options": []},
            ]
        }


def register_and_login(client, email: str, password: str, full_name: str) -> dict:
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": full_name})
    assert reg.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return login.json()["tokens"]


def build_published_survey(client):
    client.app.dependency_overrides[get_llm_dep] = lambda: FakeLLM()
    tokens = register_and_login(client, "phase3@insight.com", "PhaseThree123!", "Phase Three")
    ws = client.post(
        "/api/v1/workspaces",
        json={"name": "Phase3 WS"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert ws.status_code == 201
    ws_id = ws.json()["id"]
    project = client.post(
        f"/api/v1/workspaces/{ws_id}/projects",
        json={"name": "Phase3 Project", "description": "desc"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    survey = client.post(
        f"/api/v1/projects/{project_id}/surveys",
        json={"title": "Phase3 Survey", "goal": "Export reports"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert survey.status_code == 201
    survey_id = survey.json()["id"]

    ai = client.post(
        f"/api/v1/surveys/{survey_id}/ai-generate",
        json={"goal": "Export reports", "question_count": 3},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert ai.status_code == 200

    publish = client.post(
        f"/api/v1/surveys/{survey_id}/publish",
        json={},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert publish.status_code == 200
    return tokens, survey_id, publish.json()["public_slug"]


def test_report_generation_and_download(client):
    tokens, survey_id, _ = build_published_survey(client)

    create = client.post(
        f"/api/v1/surveys/{survey_id}/reports",
        json={"format": "pdf", "template": "executive_summary", "include_sections": ["overview"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert create.status_code == 202
    report_id = create.json()["report_id"]

    detail = client.get(
        f"/api/v1/surveys/{survey_id}/reports/{report_id}",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] in {"running", "completed", "queued"}

    listing = client.get(
        f"/api/v1/surveys/{survey_id}/reports",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert listing.status_code == 200
    assert listing.json()["count"] >= 1

    # In TestClient background tasks complete before response returns,
    # so we expect asset details to be available on a fresh fetch.
    refreshed = client.get(
        f"/api/v1/surveys/{survey_id}/reports/{report_id}",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert refreshed.status_code == 200
    asset = refreshed.json().get("asset")
    assert asset is not None

    download = client.get(f"/api/v1/exports/{asset['asset_id']}/download", params={"token": asset["download_token"]})
    assert download.status_code == 200


def test_public_rate_limit(client):
    old_limit = settings.PUBLIC_RATE_LIMIT_REQUESTS
    old_window = settings.PUBLIC_RATE_LIMIT_WINDOW_SECONDS
    settings.PUBLIC_RATE_LIMIT_REQUESTS = 2
    settings.PUBLIC_RATE_LIMIT_WINDOW_SECONDS = 60
    try:
        _, _, slug = build_published_survey(client)
        first = client.get(f"/api/v1/public/surveys/{slug}")
        second = client.get(f"/api/v1/public/surveys/{slug}")
        third = client.get(f"/api/v1/public/surveys/{slug}")
        assert first.status_code == 200
        assert second.status_code == 200
        assert third.status_code == 429
    finally:
        settings.PUBLIC_RATE_LIMIT_REQUESTS = old_limit
        settings.PUBLIC_RATE_LIMIT_WINDOW_SECONDS = old_window

