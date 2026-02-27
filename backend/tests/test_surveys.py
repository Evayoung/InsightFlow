from app.api.v1.endpoints.surveys import get_llm_dep


class FakeLLM:
    def generate_json(self, **kwargs):
        user_prompt = kwargs.get("user_prompt", "")
        if "bias and clarity" in user_prompt:
            return {
                "issues": [
                    {
                        "question_id": None,
                        "severity": "medium",
                        "reason": "slightly leading phrasing",
                        "suggested_rewrite": "How do you feel about the pricing?",
                    }
                ]
            }
        return {
            "questions": [
                {"type": "text", "text": "What did you like most?", "required": True, "order": 1, "options": []},
                {"type": "text", "text": "What should improve?", "required": False, "order": 2, "options": []},
                {"type": "rating", "text": "Rate satisfaction 1-5", "required": True, "order": 3, "options": []},
            ]
        }


def register_and_login(client, email: str, password: str, full_name: str) -> dict:
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": full_name})
    assert reg.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return login.json()["tokens"]


def setup_project(client):
    tokens = register_and_login(client, "pm@survey.com", "PmPassword123!", "PM User")
    ws = client.post(
        "/api/v1/workspaces",
        json={"name": "Survey WS"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert ws.status_code == 201
    ws_id = ws.json()["id"]
    project = client.post(
        f"/api/v1/workspaces/{ws_id}/projects",
        json={"name": "Survey Project", "description": "desc"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert project.status_code == 201
    return tokens, ws_id, project.json()["id"]


def test_survey_authoring_and_public_flow(client):
    client.app.dependency_overrides[get_llm_dep] = lambda: FakeLLM()
    tokens, _, project_id = setup_project(client)

    create = client.post(
        f"/api/v1/projects/{project_id}/surveys",
        json={"title": "Onboarding Survey", "goal": "Validate onboarding"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert create.status_code == 201
    survey_id = create.json()["id"]

    ai_generate = client.post(
        f"/api/v1/surveys/{survey_id}/ai-generate",
        json={"goal": "Validate onboarding", "question_count": 3, "tone": "neutral"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert ai_generate.status_code == 200
    assert len(ai_generate.json()["questions"]) >= 3

    bias = client.post(
        f"/api/v1/surveys/{survey_id}/bias-check",
        json={},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert bias.status_code == 200
    assert "issues" in bias.json()

    publish = client.post(
        f"/api/v1/surveys/{survey_id}/publish",
        json={},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert publish.status_code == 200
    slug = publish.json()["public_slug"]

    public_get = client.get(f"/api/v1/public/surveys/{slug}")
    assert public_get.status_code == 200
    assert public_get.json()["survey"]["id"] == survey_id

    close = client.post(
        f"/api/v1/surveys/{survey_id}/close",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert close.status_code == 200

    public_closed = client.get(f"/api/v1/public/surveys/{slug}")
    assert public_closed.status_code == 409

    client.app.dependency_overrides.clear()

