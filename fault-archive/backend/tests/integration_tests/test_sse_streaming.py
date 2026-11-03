"""API-level tests for the browser's SSE contract."""

import json

from fastapi.testclient import TestClient

from fault_archive.application_bootstrap import app

client = TestClient(app)


def test_stream_endpoint_emits_frontend_compatible_sse() -> None:
    response = client.post(
        "/api/v1/archive/stream",
        json={"truth_input": "苹果会掉下来"},
        headers={"Accept": "text/event-stream"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert 'data: {"content":' in response.text
    content = "".join(
        json.loads(line[6:])["content"]
        for line in response.text.splitlines()
        if line.startswith("data: {")
    )
    assert "苹果会掉下来" in content
    assert "data: [DONE]\n\n" in response.text


def test_stream_endpoint_rejects_blank_truth() -> None:
    response = client.post("/api/v1/archive/stream", json={"truth_input": "   "})

    assert response.status_code == 422


def test_vite_origins_are_allowed_by_cors() -> None:
    response = client.options(
        "/api/v1/archive/stream",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "accept,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"