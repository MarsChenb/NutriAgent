from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User, WeightLog

router = APIRouter(prefix="/health", tags=["健康"])


class WeightLogCreate(BaseModel):
    weight_kg: float
    body_fat_rate: float | None = None


class WeightLogResponse(BaseModel):
    id: int
    weight_kg: float
    body_fat_rate: float | None
    recorded_at: datetime

    model_config = {"from_attributes": True}


@router.post("/weight", response_model=WeightLogResponse)
async def log_weight(
    data: WeightLogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录体重"""
    log = WeightLog(
        user_id=user.id,
        weight_kg=data.weight_kg,
        body_fat_rate=data.body_fat_rate,
        recorded_at=datetime.now(),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/weight", response_model=list[WeightLogResponse])
async def get_weight_history(
    days: int = Query(default=30, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取体重历史"""
    result = await db.execute(
        select(WeightLog)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.recorded_at.desc())
        .limit(days)
    )
    return result.scalars().all()
