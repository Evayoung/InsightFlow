def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_meta(client):
    response = client.get("/meta")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "insightflow-backend"
    assert "version" in data

