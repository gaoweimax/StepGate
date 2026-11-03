"""FastAPI 应用入口。"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fault_archive.api_gateways.sse_endpoints import router as archive_router

app = FastAPI(title="Fault Archive API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)

app.include_router(archive_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """供本地运行与容器检查使用。"""

    return {"status": "ok"}