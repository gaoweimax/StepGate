import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.llm_service import get_llm_config, stream_archive

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fault-Archive API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Authorization"],
)


class GenerateRequest(BaseModel):
    truth: str = Field(min_length=1, max_length=500)
    style_key: str = Field(default="cyber_hacker", max_length=100)


def _sse_text(text: str) -> str:
    return "".join(f"data: {line}\n" for line in text.splitlines() or [""]) + "\n"


def _sse_error(message: str) -> str:
    return f"event: error\ndata: {json.dumps({'error': message})}\n\n"


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/generate")
async def generate(request: GenerateRequest) -> StreamingResponse:
    truth = request.truth.strip()
    if not truth:
        raise HTTPException(status_code=422, detail="truth must not be blank")
    get_llm_config()

    async def events() -> AsyncIterator[str]:
        try:
            async for text in stream_archive(truth, request.style_key):
                yield _sse_text(text)
        except Exception:
            logger.exception("Archive generation failed")
            yield _sse_error("Archive generation failed. Check the API key and provider.")

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
