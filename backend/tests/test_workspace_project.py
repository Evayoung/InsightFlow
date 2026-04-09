from app.api.v1.endpoints import workspaces as workspace_endpoints


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


def test_workspace_invite_sends_email(client, monkeypatch):
    captured = {}

    def fake_send_workspace_invitation_email(
        to_email: str,
        *,
        workspace_name: str,
        role: str,
        inviter_name: str,
        app_link: str,
    ) -> bool:
        captured["to_email"] = to_email
        captured["workspace_name"] = workspace_name
        captured["role"] = role
        captured["inviter_name"] = inviter_name
        captured["app_link"] = app_link
        return True

    monkeypatch.setattr(workspace_endpoints, "send_workspace_invitation_email", fake_send_workspace_invitation_email)

    owner_tokens = register_and_login(client, "owner3@example.com", "OwnerPass123!", "Owner Three")
    invited_tokens = register_and_login(client, "member3@example.com", "MemberPass123!", "Member Three")
    assert invited_tokens["access_token"]

    create_workspace = client.post(
        "/api/v1/workspaces",
        json={"name": "Invite Workspace"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert create_workspace.status_code == 201
    workspace_id = create_workspace.json()["id"]

    invite = client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "member3@example.com", "role": "viewer"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert invite.status_code == 201
    assert captured["to_email"] == "member3@example.com"
    assert captured["workspace_name"] == "Invite Workspace"
    assert captured["role"] == "viewer"
    assert captured["inviter_name"] == "Owner Three"
    assert captured["app_link"].endswith("/pages/login.html")


def test_inviting_new_email_creates_pending_invitation_and_claims_on_register(client):
    owner_tokens = register_and_login(client, "owner4@example.com", "OwnerPass123!", "Owner Four")

    create_workspace = client.post(
        "/api/v1/workspaces",
        json={"name": "Pending Invite Workspace"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert create_workspace.status_code == 201
    workspace_id = create_workspace.json()["id"]

    invite = client.post(
        f"/api/v1/workspaces/{workspace_id}/members/invite",
        json={"email": "newinvite@example.com", "role": "editor"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert invite.status_code == 201
    invited_payload = invite.json()
    assert invited_payload["email"] == "newinvite@example.com"
    assert invited_payload["status"] == "pending"
    assert invited_payload["kind"] == "invitation"
    assert invited_payload["user_id"] is None

    members_before_signup = client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert members_before_signup.status_code == 200
    pending_entry = next(item for item in members_before_signup.json()["items"] if item["email"] == "newinvite@example.com")
    assert pending_entry["status"] == "pending"
    assert pending_entry["kind"] == "invitation"

    new_user_tokens = register_and_login(client, "newinvite@example.com", "InvitePass123!", "Invited Person")
    assert new_user_tokens["access_token"]

    invited_workspaces = client.get(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {new_user_tokens['access_token']}"},
    )
    assert invited_workspaces.status_code == 200
    workspace_names = [item["name"] for item in invited_workspaces.json()["items"]]
    assert "Pending Invite Workspace" in workspace_names

    members_after_signup = client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert members_after_signup.status_code == 200
    claimed_entry = next(item for item in members_after_signup.json()["items"] if item["email"] == "newinvite@example.com")
    assert claimed_entry["status"] == "active"
    assert claimed_entry["kind"] == "member"
    assert claimed_entry["full_name"] == "Invited Person"
