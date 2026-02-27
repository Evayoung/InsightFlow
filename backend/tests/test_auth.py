from datetime import timedelta

from app.core.security import create_password_reset_token


def test_register_login_and_me(client):
    register_payload = {
        "email": "pm@example.com",
        "password": "Password123!",
        "full_name": "Product Manager",
    }
    register_response = client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == 201
    registered = register_response.json()
    assert registered["user"]["email"] == "pm@example.com"
    assert "access_token" in registered["tokens"]

    login_response = client.post(
        "/api/v1/auth/login", json={"email": "pm@example.com", "password": "Password123!"}
    )
    assert login_response.status_code == 200
    tokens = login_response.json()["tokens"]

    me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "pm@example.com"


def test_register_rejects_weak_password(client):
    payload = {
        "email": "weak@example.com",
        "password": "weakpass",
        "full_name": "Weak Password",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_password_recovery_flow(client):
    register_payload = {
        "email": "recover@example.com",
        "password": "Password123!",
        "full_name": "Recover User",
    }
    reg_response = client.post("/api/v1/auth/register", json=register_payload)
    assert reg_response.status_code == 201
    user_id = reg_response.json()["user"]["id"]

    forgot_response = client.post("/api/v1/auth/password/forgot", json={"email": "recover@example.com"})
    assert forgot_response.status_code == 200
    assert "reset email has been sent" in forgot_response.json()["message"].lower()

    reset_token = create_password_reset_token(user_id, timedelta(minutes=30))
    verify_response = client.post("/api/v1/auth/password/reset/verify", json={"token": reset_token})
    assert verify_response.status_code == 200
    assert verify_response.json() == {"valid": True}

    reset_response = client.post(
        "/api/v1/auth/password/reset",
        json={"token": reset_token, "new_password": "NewPassword123!"},
    )
    assert reset_response.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "recover@example.com", "password": "Password123!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "recover@example.com", "password": "NewPassword123!"},
    )
    assert new_login.status_code == 200
