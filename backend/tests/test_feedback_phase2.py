from app.api.v1.endpoints.surveys import get_llm_dep


class FakeLLM:
    def generate_json(self, **kwargs):
        return {
            "questions": [
                {"type": "text", "text": "What do you think?", "required": True, "order": 1, "options": []},
                {"type": "text", "text": "What can improve?", "required": False, "order": 2, "options": []},
                {"type": "rating", "text": "Rate us", "required": True, "order": 3, "options": []},
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
    tokens = register_and_login(client, "phase2@insight.com", "PhaseTwo123!", "Phase Two")
    ws = client.post(
        "/api/v1/workspaces",
        json={"name": "Phase2 WS"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert ws.status_code == 201
    ws_id = ws.json()["id"]
    project = client.post(
        f"/api/v1/workspaces/{ws_id}/projects",
        json={"name": "Phase2 Project", "description": "desc"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    survey = client.post(
        f"/api/v1/projects/{project_id}/surveys",
        json={"title": "Phase2 Survey", "goal": "Understand feedback"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert survey.status_code == 201
    survey_id = survey.json()["id"]

    ai = client.post(
        f"/api/v1/surveys/{survey_id}/ai-generate",
        json={"goal": "Understand feedback", "question_count": 3},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert ai.status_code == 200

    detail = client.get(f"/api/v1/surveys/{survey_id}", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert detail.status_code == 200
    questions = detail.json()["questions"]

    publish = client.post(
        f"/api/v1/surveys/{survey_id}/publish",
        json={},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert publish.status_code == 200
    return tokens, survey_id, publish.json()["public_slug"], questions


def test_phase2_feedback_and_insights_flow(client):
    tokens, survey_id, slug, questions = build_published_survey(client)
    required_questions = [q for q in questions if q["required"]]

    submit = client.post(
        f"/api/v1/public/surveys/{slug}/responses",
        json={
            "answers": [{"question_id": q["id"], "value": "This is good but pricing is confusing"} for q in required_questions],
            "respondent_meta": {"source": "email"},
        },
    )
    assert submit.status_code == 201
    response_id = submit.json()["response_id"]

    responses = client.get(
        f"/api/v1/surveys/{survey_id}/responses",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert responses.status_code == 200
    assert responses.json()["count"] >= 1

    response_detail = client.get(
        f"/api/v1/surveys/{survey_id}/responses/{response_id}",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response_detail.status_code == 200

    run_resp = client.post(
        f"/api/v1/surveys/{survey_id}/insights/run",
        json={"force": True},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert run_resp.status_code == 202
    run_id = run_resp.json()["run_id"]

    run_detail = client.get(
        f"/api/v1/surveys/{survey_id}/insights/runs/{run_id}",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert run_detail.status_code == 200
    assert run_detail.json()["status"] in {"running", "completed", "queued"}

    latest = client.get(
        f"/api/v1/surveys/{survey_id}/insights/latest",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert latest.status_code == 200
    assert "overview" in latest.json()

    personas = client.post(
        f"/api/v1/surveys/{survey_id}/personas/generate",
        json={"force": True},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert personas.status_code == 200
    assert personas.json()["count"] >= 1

    metric = client.get(
        f"/api/v1/surveys/{survey_id}/analytics/completion",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert metric.status_code == 200
    body = metric.json()
    assert body["generated_ai_surveys"] == 1
    assert body["completed_ai_surveys"] == 1

    client.app.dependency_overrides.clear()

