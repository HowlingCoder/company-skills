from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from skill_management.web import create_app


@pytest.fixture
def web_client(tmp_path: Path) -> TestClient:
    (tmp_path / "index.html").write_text("<app-root></app-root>")
    (tmp_path / "main.js").write_text("console.log('frontend')")
    return TestClient(create_app(tmp_path))


def test_api_is_served_under_the_api_prefix(web_client: TestClient) -> None:
    response = web_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_serves_the_frontend(web_client: TestClient) -> None:
    response = web_client.get("/")

    assert response.status_code == 200
    assert "<app-root>" in response.text
    assert response.headers["content-type"].startswith("text/html")


def test_frontend_assets_are_served(web_client: TestClient) -> None:
    response = web_client.get("/main.js")

    assert response.status_code == 200
    assert "frontend" in response.text


def test_unknown_api_path_is_a_json_404_not_the_frontend(
    web_client: TestClient,
) -> None:
    response = web_client.get("/api/nope")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_api_routes_are_not_reachable_without_the_prefix(
    web_client: TestClient,
) -> None:
    # /health exists only under /api; at the root there is just the frontend
    response = web_client.get("/health")

    assert response.status_code == 404
