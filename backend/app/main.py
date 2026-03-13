from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    from app.db import engine
    await engine.dispose()


app = FastAPI(
    title="NutriAgent",
    description="AI 营养管理与饮食追踪系统",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    from app.config import settings
    import os
    return {
        "status": "ok",
        "api_key_set": bool(settings.DEEPSEEK_API_KEY),
        "api_key_prefix": settings.DEEPSEEK_API_KEY[:8] if settings.DEEPSEEK_API_KEY else "empty",
        "pid": os.getpid(),
    }
