from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem, FoodNutrition
from app.models.meal import DailyNutritionSummary, MealLog, MealLogItem
from app.models.user import UserProfile

MEAL_TARGET_RATIOS = {
    "breakfast": 0.25,
    "lunch": 0.35,
    "dinner": 0.30,
    "snack": 0.10,
}


def build_meal_ai_summary(
    meal_type: str,
    total_cal: float,
    total_protein: float,
    total_fat: float,
    total_carb: float,
    calorie_target: int | None,
) -> str:
    target = calorie_target or 2000
    meal_target = max(120, round(target * MEAL_TARGET_RATIOS.get(meal_type, 0.2)))

    if total_cal > meal_target * 1.15:
        calorie_comment = "这顿热量偏高，后面一餐建议收一点。"
    elif total_cal >= meal_target * 0.75:
        calorie_comment = "这顿热量控制得不错。"
    else:
        calorie_comment = "这顿热量偏低，注意别因为吃太少影响饱腹感。"

    if total_protein >= 20:
        protein_comment = "蛋白质达标，饱腹感和恢复都会更稳。"
    else:
        protein_comment = "蛋白质偏少，下一餐可以补鸡胸肉、鸡蛋或豆制品。"

    fat_comment = (
        "脂肪略高，烹调油和高脂配菜要留意。"
        if total_fat >= 20
        else "脂肪压力不大。"
    )
    carb_comment = (
        "碳水稍多，后续主食可以适当减一点。"
        if total_carb >= 60
        else "碳水整体在可控范围内。"
    )

    next_step = {
        "breakfast": "午餐优先补蛋白和蔬菜，别再靠精制主食堆饱。",
        "lunch": "晚餐尽量清爽一点，把蛋白质补足就够了。",
        "dinner": "今晚后续如果还饿，优先选酸奶、牛奶或水果，不要再加高油宵夜。",
        "snack": "把加餐控制在计划内，后面的正餐继续按节奏吃。",
    }.get(meal_type, "继续按今天的热量预算往下走。")

    return f"{calorie_comment}{protein_comment}{fat_comment}{carb_comment}{next_step}"


async def create_meal(
    db: AsyncSession,
    user_id: int,
    meal_type: str,
    meal_date: date,
    items: list[dict],
    input_mode: str = "manual",
    raw_input: str | None = None,
) -> MealLog:
    total_cal = 0.0
    total_protein = 0.0
    total_fat = 0.0
    total_carb = 0.0

    meal_log = MealLog(
        user_id=user_id,
        meal_type=meal_type,
        meal_date=meal_date,
        input_mode=input_mode,
        raw_input=raw_input,
    )
    db.add(meal_log)
    await db.flush()

    for item in items:
        food_id = item["food_id"]
        amount_g = item["amount_g"]

        result = await db.execute(
            select(FoodNutrition).where(FoodNutrition.food_id == food_id)
        )
        nutr = result.scalar_one_or_none()

        cal = float(nutr.calories_kcal or 0) * amount_g / 100 if nutr else 0
        protein = float(nutr.protein_g or 0) * amount_g / 100 if nutr else 0
        fat = float(nutr.fat_g or 0) * amount_g / 100 if nutr else 0
        carb = float(nutr.carb_g or 0) * amount_g / 100 if nutr else 0

        food_result = await db.execute(select(FoodItem).where(FoodItem.id == food_id))
        food = food_result.scalar_one_or_none()

        meal_item = MealLogItem(
            meal_log_id=meal_log.id,
            food_id=food_id,
            recognized_name=food.food_name if food else None,
            amount_g=amount_g,
            amount_text=item.get("amount_text"),
            calories_kcal=round(cal, 2),
            protein_g=round(protein, 2),
            fat_g=round(fat, 2),
            carb_g=round(carb, 2),
        )
        db.add(meal_item)

        total_cal += cal
        total_protein += protein
        total_fat += fat
        total_carb += carb

    meal_log.total_calories_kcal = round(total_cal, 2)
    meal_log.total_protein_g = round(total_protein, 2)
    meal_log.total_fat_g = round(total_fat, 2)
    meal_log.total_carb_g = round(total_carb, 2)

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    calorie_target = (
        int(profile.daily_calorie_target)
        if profile and profile.daily_calorie_target
        else 2000
    )
    meal_log.ai_summary = build_meal_ai_summary(
        meal_type=meal_type,
        total_cal=total_cal,
        total_protein=total_protein,
        total_fat=total_fat,
        total_carb=total_carb,
        calorie_target=calorie_target,
    )

    await update_daily_summary(db, user_id, meal_date)

    await db.commit()
    return meal_log


async def update_daily_summary(db: AsyncSession, user_id: int, summary_date: date):
    result = await db.execute(
        select(
            func.sum(MealLog.total_calories_kcal),
            func.sum(MealLog.total_protein_g),
            func.sum(MealLog.total_fat_g),
            func.sum(MealLog.total_carb_g),
            func.count(MealLog.id),
        ).where(MealLog.user_id == user_id, MealLog.meal_date == summary_date)
    )
    row = result.first()
    total_cal = float(row[0] or 0)
    total_protein = float(row[1] or 0)
    total_fat = float(row[2] or 0)
    total_carb = float(row[3] or 0)
    meals_count = row[4] or 0

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    calorie_target = profile.daily_calorie_target if profile else 2000
    remaining = (calorie_target or 2000) - total_cal

    summary_result = await db.execute(
        select(DailyNutritionSummary).where(
            DailyNutritionSummary.user_id == user_id,
            DailyNutritionSummary.summary_date == summary_date,
        )
    )
    summary = summary_result.scalar_one_or_none()
    if not summary:
        summary = DailyNutritionSummary(user_id=user_id, summary_date=summary_date)
        db.add(summary)

    summary.total_calories_kcal = round(total_cal, 2)
    summary.total_protein_g = round(total_protein, 2)
    summary.total_fat_g = round(total_fat, 2)
    summary.total_carb_g = round(total_carb, 2)
    summary.meals_count = meals_count
    summary.calorie_remaining_kcal = round(remaining, 2)


async def get_daily_summary(db: AsyncSession, user_id: int, summary_date: date) -> dict:
    result = await db.execute(
        select(DailyNutritionSummary).where(
            DailyNutritionSummary.user_id == user_id,
            DailyNutritionSummary.summary_date == summary_date,
        )
    )
    summary = result.scalar_one_or_none()

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    calorie_target = profile.daily_calorie_target if profile else 2000

    if summary:
        return {
            "summary_date": summary_date,
            "total_calories_kcal": float(summary.total_calories_kcal or 0),
            "total_protein_g": float(summary.total_protein_g or 0),
            "total_fat_g": float(summary.total_fat_g or 0),
            "total_carb_g": float(summary.total_carb_g or 0),
            "meals_count": summary.meals_count or 0,
            "calorie_target": calorie_target,
            "calorie_remaining_kcal": float(summary.calorie_remaining_kcal or 0),
        }

    return {
        "summary_date": summary_date,
        "total_calories_kcal": 0,
        "total_protein_g": 0,
        "total_fat_g": 0,
        "total_carb_g": 0,
        "meals_count": 0,
        "calorie_target": calorie_target,
        "calorie_remaining_kcal": float(calorie_target or 2000),
    }
