from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_returns_versioned_status() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "resilicity-api",
        "api_version": "0.2.0",
        "graph_version": "0.3.0",
    }


def test_health_allows_configured_development_origin() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_health_does_not_allow_unknown_origin() -> None:
    response = client.get("/health", headers={"Origin": "https://untrusted.example"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
