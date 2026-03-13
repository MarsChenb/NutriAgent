from datetime import date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem, FoodNutrition
from app.models.meal import DailyNutritionSummary, MealLog, MealLogItem
from app.models.user import UserProfile


async def create_meal(
    db: AsyncSession,
    user_id: int,
    meal_type: str,
    meal_date: date,
    items: list[dict],
    input_mode: str = "manual",
    raw_input: str | None = None,
) -> MealLog:
    """Create a meal log with items and calculate nutrition."""
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

        # Look up nutrition per 100g
        result = await db.execute(
            select(FoodNutrition).where(FoodNutrition.food_id == food_id)
        )
        nutr = result.scalar_one_or_none()

        cal = float(nutr.calories_kcal or 0) * amount_g / 100 if nutr else 0
        protein = float(nutr.protein_g or 0) * amount_g / 100 if nutr else 0
        fat = float(nutr.fat_g or 0) * amount_g / 100 if nutr else 0
        carb = float(nutr.carb_g or 0) * amount_g / 100 if nutr else 0

        # Get food name
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

    # Update daily summary
    await update_daily_summary(db, user_id, meal_date)

    await db.commit()
    return meal_log


async def update_daily_summary(db: AsyncSession, user_id: int, summary_date: date):
    """Recalculate daily nutrition summary."""
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

    # Get user calorie target
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    calorie_target = profile.daily_calorie_target if profile else 2000
    remaining = (calorie_target or 2000) - total_cal

    # Upsert daily summary
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
    """Get daily nutrition summary."""
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
