def register_and_login(client, email: str, password: str, full_name: str) -> dict:
    register_payload = {"email": email, "password": password, "full_name": full_name}
    reg = client.post("/api/v1/auth/register", json=register_payload)
    assert reg.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return login.json()["tokens"]


def test_workspace_and_project_flow(client):
    owner_tokens = register_and_login(client, "owner@example.com", "OwnerPass123!", "Owner User")
    editor_tokens = register_and_login(client, "editor@example.com", "EditorPass123!", "Editor User")

    create_workspace = client.post(
        "/api/v1/workspaces",
        json={"name": "Insight Team"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert create_workspace.status_code == 201
    workspace_id = create_workspace.json()["id"]

    invite_editor = client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "editor@example.com", "role": "editor"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert invite_editor.status_code == 201

    create_project = client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Feedback Revamp", "description": "Core PM test project"},
        headers={"Authorization": f"Bearer {editor_tokens['access_token']}"},
    )
    assert create_project.status_code == 201
    project_id = create_project.json()["id"]

    list_projects = client.get(
        f"/api/v1/workspaces/{workspace_id}/projects",
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert list_projects.status_code == 200
    assert list_projects.json()["count"] == 1

    update_project = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Feedback Revamp V2"},
        headers={"Authorization": f"Bearer {editor_tokens['access_token']}"},
    )
    assert update_project.status_code == 200
    assert update_project.json()["name"] == "Feedback Revamp V2"

    archive_project = client.delete(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {editor_tokens['access_token']}"},
    )
    assert archive_project.status_code == 204


def test_non_member_cannot_access_workspace(client):
    owner_tokens = register_and_login(client, "owner2@example.com", "OwnerPass123!", "Owner Two")
    outsider_tokens = register_and_login(client, "outsider@example.com", "Outsider123!", "Outsider User")

    create_workspace = client.post(
        "/api/v1/workspaces",
        json={"name": "Private Workspace"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert create_workspace.status_code == 201
    workspace_id = create_workspace.json()["id"]

    forbidden = client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers={"Authorization": f"Bearer {outsider_tokens['access_token']}"},
    )
    assert forbidden.status_code == 403

