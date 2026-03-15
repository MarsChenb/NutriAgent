from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.coach_personas import get_coach_persona
from app.config import settings
from app.db import get_db
from app.dependencies import get_current_user
from app.models.meal import DailyNutritionSummary
from app.models.user import User, UserProfile, WeightLog

router = APIRouter(prefix="/health", tags=["健康"])
llm_client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


class WeightLogCreate(BaseModel):
    weight_kg: float
    body_fat_rate: float | None = None


class WeightLogResponse(BaseModel):
    id: int
    weight_kg: float
    body_fat_rate: float | None
    recorded_at: datetime

    model_config = {"from_attributes": True}


class WeeklyReviewDay(BaseModel):
    summary_date: date
    total_calories_kcal: float
    total_exercise_calories_kcal: float
    calorie_deficit_kcal: float
    weight_kg: float | None = None
    status: str


class WeeklyReviewResponse(BaseModel):
    week_start: date
    week_end: date
    daily_items: list[WeeklyReviewDay]
    weekly_summary_ai: str
    weight_change_kg: float | None = None


def resolve_status(total_calories_kcal: float, exercise_kcal: float, calorie_deficit_kcal: float) -> str:
    if total_calories_kcal <= 0 and exercise_kcal <= 0:
        return "数据不足"
    if 250 <= calorie_deficit_kcal <= 900:
        return "达标"
    return "未达标"


async def build_weekly_ai_summary(profile: UserProfile | None, review_days: list[dict], weight_change: float | None) -> str:
    coach = get_coach_persona(profile.coach_persona if profile else None)
    lines = [
        f"- {item['summary_date']}: 摄入 {item['total_calories_kcal']:.0f} kcal，运动 {item['total_exercise_calories_kcal']:.0f} kcal，缺口 {item['calorie_deficit_kcal']:.0f} kcal，状态 {item['status']}"
        for item in review_days
    ]
    context = "\n".join(lines)
    weight_text = f"本周体重变化 {weight_change:+.1f} kg" if weight_change is not None else "本周体重数据不足"

    fallback = _build_weekly_fallback(review_days, weight_change)
    if not settings.DEEPSEEK_API_KEY:
        return fallback

    try:
        response = await llm_client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": f"你是 NutriAgent 的 AI 周复盘教练，当前人格是 {coach.name}，风格为{coach.style}。{coach.system_tone}请输出 3 个自然段：1. 本周做得好的地方 2. 最大问题 3. 下周建议。每段 1-2 句，务必结合提供的数据，不要空泛。",
                },
                {
                    "role": "user",
                    "content": f"用户目标：{profile.goal_type if profile and profile.goal_type else '未设置'}\n{weight_text}\n最近 7 天数据：\n{context}",
                },
            ],
            temperature=0.7,
            max_tokens=500,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return fallback


def _build_weekly_fallback(review_days: list[dict], weight_change: float | None) -> str:
    reached = sum(1 for item in review_days if item["status"] == "达标")
    insufficient = sum(1 for item in review_days if item["status"] == "数据不足")
    avg_deficit = sum(item["calorie_deficit_kcal"] for item in review_days) / max(len(review_days), 1)

    good = f"本周有 {reached} 天达到热量缺口目标，平均每日缺口约 {avg_deficit:.0f} kcal。"
    if weight_change is not None:
        good += f" 体重变化为 {weight_change:+.1f} kg。"

    issue = (
        f"有 {insufficient} 天数据不足，说明记录连续性还不够。"
        if insufficient > 0
        else "主要问题在于部分天数缺口偏离目标区间，执行波动还比较明显。"
    )
    next_step = "下周优先保证每天至少补齐饮食和运动记录，再把热量缺口稳定在目标范围内。"
    return f"本周做得好的地方：{good}\n\n最大问题：{issue}\n\n下周建议：{next_step}"


@router.post("/weight", response_model=WeightLogResponse)
async def log_weight(
    data: WeightLogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    result = await db.execute(
        select(WeightLog)
        .where(WeightLog.user_id == user.id)
        .order_by(WeightLog.recorded_at.desc())
        .limit(days)
    )
    return result.scalars().all()


@router.get("/weekly-review", response_model=WeeklyReviewResponse)
async def get_weekly_review(
    end_date: date = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_end = end_date or date.today()
    week_start = target_end - timedelta(days=6)

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()

    summary_result = await db.execute(
        select(DailyNutritionSummary)
        .where(
            DailyNutritionSummary.user_id == user.id,
            DailyNutritionSummary.summary_date >= week_start,
            DailyNutritionSummary.summary_date <= target_end,
        )
        .order_by(DailyNutritionSummary.summary_date.asc())
    )
    summary_map = {item.summary_date: item for item in summary_result.scalars().all()}

    weight_result = await db.execute(
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.recorded_at >= datetime.combine(week_start, datetime.min.time()))
        .order_by(WeightLog.recorded_at.asc())
    )
    weight_logs = list(weight_result.scalars().all())
    weight_by_date: dict[date, float] = {}
    for log in weight_logs:
        weight_by_date[log.recorded_at.date()] = float(log.weight_kg)

    review_days: list[dict] = []
    for offset in range(7):
        current_date = week_start + timedelta(days=offset)
        summary = summary_map.get(current_date)
        total_calories = float(summary.total_calories_kcal or 0) if summary else 0
        total_exercise = float(summary.total_exercise_calories_kcal or 0) if summary else 0
        deficit = float(summary.calorie_deficit_kcal or 0) if summary else 0
        review_days.append(
            {
                "summary_date": current_date,
                "total_calories_kcal": total_calories,
                "total_exercise_calories_kcal": total_exercise,
                "calorie_deficit_kcal": deficit,
                "weight_kg": weight_by_date.get(current_date),
                "status": resolve_status(total_calories, total_exercise, deficit),
            }
        )

    weights = [item["weight_kg"] for item in review_days if item["weight_kg"] is not None]
    weight_change = round(weights[-1] - weights[0], 1) if len(weights) >= 2 else None
    weekly_summary_ai = await build_weekly_ai_summary(profile, review_days, weight_change)

    return WeeklyReviewResponse(
        week_start=week_start,
        week_end=target_end,
        daily_items=[WeeklyReviewDay(**item) for item in review_days],
        weekly_summary_ai=weekly_summary_ai,
        weight_change_kg=weight_change,
    )
