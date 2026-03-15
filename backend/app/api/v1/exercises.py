from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies import get_current_user
from app.models.exercise import ExerciseLog
from app.models.user import User
from app.schemas.exercise import ExerciseCreateRequest, ExerciseLogResponse
from app.services.exercise_service import create_exercise, list_exercises
from app.services.meal_service import update_daily_summary

router = APIRouter(prefix="/exercises", tags=["运动记录"])


@router.post("/", response_model=ExerciseLogResponse)
async def create_exercise_log(
    data: ExerciseCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exercise_date = data.exercise_date or date.today()
    exercise = await create_exercise(
        db=db,
        user_id=user.id,
        exercise_type=data.exercise_type,
        exercise_date=exercise_date,
        duration_minutes=data.duration_minutes,
        calories_burned_kcal=data.calories_burned_kcal,
        notes=data.notes,
    )
    return ExerciseLogResponse.model_validate(exercise)


@router.get("/", response_model=list[ExerciseLogResponse])
async def get_exercise_logs(
    exercise_date: date = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exercises = await list_exercises(db, user.id, exercise_date)
    return [ExerciseLogResponse.model_validate(item) for item in exercises]


@router.delete("/{exercise_id}")
async def delete_exercise_log(
    exercise_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExerciseLog).where(ExerciseLog.id == exercise_id, ExerciseLog.user_id == user.id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="运动记录不存在")

    exercise_date = exercise.exercise_date
    await db.delete(exercise)
    await update_daily_summary(db, user.id, exercise_date)
    await db.commit()
    return {"message": "删除成功"}
