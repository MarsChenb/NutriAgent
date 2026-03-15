from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.models import Base


async def ensure_runtime_schema(app: FastAPI):
    from app.db import engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS coach_persona VARCHAR(32)"))
        await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS age INTEGER"))
        await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS body_shape VARCHAR(32)"))
        await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS medical_history TEXT"))
        await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE daily_nutrition_summary ADD COLUMN IF NOT EXISTS total_exercise_calories_kcal NUMERIC(8, 2)"))
        await conn.execute(text("ALTER TABLE daily_nutrition_summary ADD COLUMN IF NOT EXISTS exercise_count INTEGER DEFAULT 0"))
        await conn.execute(text("ALTER TABLE daily_nutrition_summary ADD COLUMN IF NOT EXISTS calorie_deficit_kcal NUMERIC(8, 2)"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_runtime_schema(app)
    yield
    from app.db import engine
    await engine.dispose()


app = FastAPI(
    title="NutriAgent",
    description="AI 营养管理与健康记录系统",
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
