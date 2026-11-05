import json
import os
from collections.abc import AsyncIterator

import httpx
from fastapi import HTTPException

from app.prompts import build_messages


def get_llm_config() -> tuple[str, str, str]:
    api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set DEEPSEEK_API_KEY or OPENAI_API_KEY in backend/.env.",
        )

    base_url = (
        os.getenv("DEEPSEEK_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
        or "https://api.deepseek.com/v1"
    ).rstrip("/")
    model = (
        os.getenv("DEEPSEEK_MODEL")
        or os.getenv("OPENAI_MODEL")
        or "deepseek-chat"
    )
    return api_key, base_url, model


async def stream_archive(truth: str, style_key: str) -> AsyncIterator[str]:
    api_key, base_url, model = get_llm_config()
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": model,
        "messages": build_messages(truth, style_key),
        "stream": True,
        "temperature": 0.9,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        async with client.stream(
            "POST",
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as response:
            if response.is_error:
                await response.aread()
                raise RuntimeError(
                    f"LLM provider returned HTTP {response.status_code}."
                )

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data:
                    continue
                if data == "[DONE]":
                    return

                try:
                    event = json.loads(data)
                except json.JSONDecodeError as exc:
                    raise RuntimeError(
                        "LLM provider returned malformed streaming data."
                    ) from exc

                if "error" in event:
                    raise RuntimeError("LLM provider reported a streaming error.")

                choices = event.get("choices")
                if not isinstance(choices, list) or not choices:
                    continue
                delta = choices[0].get("delta", {})
                text = delta.get("content") if isinstance(delta, dict) else None
                if isinstance(text, str) and text:
                    yield text
