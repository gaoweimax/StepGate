import json

import httpx
from fastapi.testclient import TestClient

from fault_archive.main import app
from fault_archive.core_engine.prompt_orchestrator import (
    build_chat_completion_payload,
    SYSTEM_PROMPT,
)

client = TestClient(app)


def test_root_serves_static_frontend() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "FAULT ARCHIVE" in response.text
    assert "/app.js" in response.text


def test_generate_stream_returns_all_stage_markers(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "test-model")

    class MockAsyncClient:
        def __init__(self, **kwargs) -> None:
            pass

        def build_request(self, method, url, *, headers, json):
            return httpx.Request(method, url, headers=headers, json=json)

        async def send(self, request, *, stream):
            chunks = [
                {"choices": [{"delta": {"content": "<<<STAGE:ANCHOR>>>【档案编号：FA-01】"}}]},
                {"choices": [{"delta": {"content": "\n<<<STAGE:HYPOTHESIS>>>【错误假设】"}}]},
                {"choices": [{"delta": {"content": "\n<<<STAGE:FAILURE>>>【灾难实验】"}}]},
                {"choices": [{"delta": {"content": "\n<<<STAGE:DISCOVERY>>>【意外发现】"}}]},
            ]
            body = "".join(f"data: {json.dumps(chunk)}\n\n" for chunk in chunks)
            body += "data: [DONE]\n\n"
            return httpx.Response(200, request=request, content=body.encode())

        async def aclose(self) -> None:
            pass

    monkeypatch.setattr(
        "fault_archive.api_gateways.sse_endpoints.httpx.AsyncClient",
        MockAsyncClient,
    )
    response = client.post(
        "/api/v1/generate",
        json={"truth": "光速是不变的", "style_key": "cyber_hacker"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "data: " in response.text
    for stage in ("ANCHOR", "HYPOTHESIS", "FAILURE", "DISCOVERY"):
        assert f"<<<STAGE:{stage}>>>" in response.text


def test_generate_requires_an_llm_api_key(monkeypatch) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/api/v1/generate",
        json={"truth": "地球是圆的"},
    )

    assert response.status_code == 503
    assert "DEEPSEEK_API_KEY" in response.json()["detail"]


def test_generate_rejects_blank_truth() -> None:
    response = client.post(
        "/api/v1/generate",
        json={"truth": "   ", "style_key": "cyber_hacker"},
    )

    assert response.status_code == 422


def test_prompt_requests_the_required_archive_sections() -> None:
    payload = build_chat_completion_payload("地球是圆的", "cyber_hacker", "deepseek-chat")

    assert payload["stream"] is True
    assert payload["model"] == "deepseek-chat"
    assert "【档案编号：XXX】" in SYSTEM_PROMPT
    assert "【错误假设】" in SYSTEM_PROMPT
    assert "【灾难实验】" in SYSTEM_PROMPT
    assert "【意外发现】" in SYSTEM_PROMPT
