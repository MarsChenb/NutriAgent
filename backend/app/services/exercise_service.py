from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import ExerciseLog
from app.services.meal_service import update_daily_summary


def build_exercise_ai_summary(exercise_type: str, duration_minutes: int, calories_burned_kcal: float) -> str:
    if calories_burned_kcal >= 450:
        intensity_comment = "这一练消耗很高，今天恢复和补水要跟上。"
    elif calories_burned_kcal >= 250:
        intensity_comment = "这次训练强度不错，已经把热量缺口拉开了。"
    else:
        intensity_comment = "这次运动量适中，重在把节奏稳定住。"

    if duration_minutes >= 60:
        duration_comment = "时长已经很扎实，注意拉伸和睡眠恢复。"
    elif duration_minutes >= 30:
        duration_comment = "时长合适，适合作为日常可持续安排。"
    else:
        duration_comment = "时间不算长，但比完全不动强很多。"

    type_comment_map = {
        "walking": "步行类运动对建立日常消耗很友好。",
        "running": "跑步已经有效提升了心肺和能量消耗。",
        "cycling": "骑行对下肢耐力和有氧表现很有帮助。",
        "strength": "力量训练有助于保住肌肉量，减脂期很值得保留。",
        "hiit": "高强度间歇训练刺激强，后续饮食别乱补。",
        "yoga": "瑜伽和拉伸类运动对恢复和身体状态很有帮助。",
        "swimming": "游泳是全身参与度很高的有氧训练。",
    }
    type_comment = type_comment_map.get(exercise_type, "这次运动记录已经计入今天的能量平衡。")

    return f"{intensity_comment}{duration_comment}{type_comment}"


async def create_exercise(
    db: AsyncSession,
    user_id: int,
    exercise_type: str,
    exercise_date: date,
    duration_minutes: int,
    calories_burned_kcal: float,
    notes: str | None = None,
) -> ExerciseLog:
    exercise = ExerciseLog(
        user_id=user_id,
        exercise_type=exercise_type,
        exercise_date=exercise_date,
        duration_minutes=duration_minutes,
        calories_burned_kcal=round(calories_burned_kcal, 2),
        notes=notes,
        ai_summary=build_exercise_ai_summary(exercise_type, duration_minutes, calories_burned_kcal),
    )
    db.add(exercise)
    await db.flush()

    await update_daily_summary(db, user_id, exercise_date)
    await db.commit()
    return exercise


async def list_exercises(db: AsyncSession, user_id: int, exercise_date: date | None = None) -> list[ExerciseLog]:
    query = select(ExerciseLog).where(ExerciseLog.user_id == user_id)
    if exercise_date:
        query = query.where(ExerciseLog.exercise_date == exercise_date)
    query = query.order_by(ExerciseLog.created_at.desc()).limit(20)

    result = await db.execute(query)
    return list(result.scalars().all())
