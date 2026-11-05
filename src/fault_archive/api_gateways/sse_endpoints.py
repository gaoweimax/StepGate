import json
import logging
import os
from collections.abc import AsyncIterator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from fault_archive.core_engine.prompt_orchestrator import (
    build_chat_completion_payload,
    iter_completion_text,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["archive"])


class GenerateRequest(BaseModel):
    truth: str = Field(min_length=1, max_length=500)
    style_key: str = Field(default="cyber_hacker", max_length=100)


def _sse_data(text: str) -> str:
    return "".join(f"data: {line}\n" for line in text.split("\n")) + "\n"


def _sse_error(message: str) -> str:
    return f"event: error\ndata: {json.dumps({'error': message})}\n\n"


@router.post("/generate")
async def generate(request: GenerateRequest) -> StreamingResponse:
    truth = request.truth.strip()
    if not truth:
        raise HTTPException(status_code=422, detail="truth must not be blank")

    api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Configure DEEPSEEK_API_KEY or OPENAI_API_KEY to enable generation.",
        )

    base_url = (
        os.getenv("OPENAI_BASE_URL")
        or os.getenv("DEEPSEEK_BASE_URL")
        or "https://api.deepseek.com/v1"
    ).rstrip("/")
    model = (
        os.getenv("DEEPSEEK_MODEL")
        or os.getenv("OPENAI_MODEL")
        or "deepseek-chat"
    )
    client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))
    upstream_request = client.build_request(
        "POST",
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json=build_chat_completion_payload(truth, request.style_key, model),
    )

    try:
        upstream = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        await client.aclose()
        logger.exception("Could not connect to the LLM provider")
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the LLM provider.",
        ) from exc

    if upstream.is_error:
        await upstream.aread()
        await upstream.aclose()
        await client.aclose()
        logger.error("LLM provider returned HTTP %s", upstream.status_code)
        raise HTTPException(
            status_code=502,
            detail=f"LLM provider returned HTTP {upstream.status_code}.",
        )

    async def stream() -> AsyncIterator[str]:
        try:
            async for text in iter_completion_text(upstream):
                yield _sse_data(text)
        except (httpx.HTTPError, ValueError):
            logger.exception("Failed while reading the LLM provider stream")
            yield _sse_error("The LLM provider stream failed.")
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
