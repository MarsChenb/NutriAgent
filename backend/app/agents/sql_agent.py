"""SQL Agent: queries nutrition, meals, and exercise summaries."""
from datetime import date, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import ExerciseLog
from app.models.food import FoodItem, FoodNutrition
from app.models.meal import DailyNutritionSummary, MealLog, MealLogItem
from app.models.user import UserProfile


async def lookup_food_nutrition(db: AsyncSession, food_name: str) -> list[dict]:
    pattern = f"%{food_name}%"
    result = await db.execute(
        select(FoodItem, FoodNutrition)
        .join(FoodNutrition, FoodItem.id == FoodNutrition.food_id)
        .where(
            or_(
                FoodItem.food_name.ilike(pattern),
                FoodItem.alias_names.ilike(pattern),
            )
        )
        .limit(5)
    )
    rows = result.all()
    return [
        {
            "food_id": food.id,
            "food_name": food.food_name,
            "category": food.category,
            "calories_kcal": float(nutr.calories_kcal or 0),
            "protein_g": float(nutr.protein_g or 0),
            "fat_g": float(nutr.fat_g or 0),
            "carb_g": float(nutr.carb_g or 0),
        }
        for food, nutr in rows
    ]


async def get_daily_intake(db: AsyncSession, user_id: int, target_date: date | None = None) -> dict:
    target_date = target_date or date.today()
    result = await db.execute(
        select(DailyNutritionSummary).where(
            DailyNutritionSummary.user_id == user_id,
            DailyNutritionSummary.summary_date == target_date,
        )
    )
    summary = result.scalar_one_or_none()

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    target = int(profile.daily_calorie_target) if profile and profile.daily_calorie_target else 2000

    if summary:
        return {
            "date": str(target_date),
            "total_calories_kcal": float(summary.total_calories_kcal or 0),
            "total_protein_g": float(summary.total_protein_g or 0),
            "total_fat_g": float(summary.total_fat_g or 0),
            "total_carb_g": float(summary.total_carb_g or 0),
            "meals_count": summary.meals_count or 0,
            "exercise_count": summary.exercise_count or 0,
            "total_exercise_calories_kcal": float(summary.total_exercise_calories_kcal or 0),
            "calorie_target": target,
            "calorie_remaining": float(summary.calorie_remaining_kcal or 0),
            "calorie_deficit": float(summary.calorie_deficit_kcal or 0),
        }

    return {
        "date": str(target_date),
        "total_calories_kcal": 0,
        "total_protein_g": 0,
        "total_fat_g": 0,
        "total_carb_g": 0,
        "meals_count": 0,
        "exercise_count": 0,
        "total_exercise_calories_kcal": 0,
        "calorie_target": target,
        "calorie_remaining": float(target),
        "calorie_deficit": float(target),
    }


async def get_recent_meals(db: AsyncSession, user_id: int, days: int = 2) -> list[dict]:
    start_date = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(MealLog)
        .where(MealLog.user_id == user_id, MealLog.meal_date >= start_date)
        .order_by(MealLog.created_at.desc())
        .limit(10)
    )
    meals = result.scalars().all()
    output = []
    for meal in meals:
        items_result = await db.execute(
            select(MealLogItem).where(MealLogItem.meal_log_id == meal.id)
        )
        items = items_result.scalars().all()
        output.append(
            {
                "meal_type": meal.meal_type,
                "meal_date": str(meal.meal_date),
                "total_calories_kcal": float(meal.total_calories_kcal or 0),
                "ai_summary": meal.ai_summary,
                "items": [
                    {
                        "name": item.recognized_name,
                        "amount_g": float(item.amount_g or 0),
                        "calories_kcal": float(item.calories_kcal or 0),
                    }
                    for item in items
                ],
            }
        )
    return output


async def get_recent_exercises(db: AsyncSession, user_id: int, days: int = 3) -> list[dict]:
    start_date = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(ExerciseLog)
        .where(ExerciseLog.user_id == user_id, ExerciseLog.exercise_date >= start_date)
        .order_by(ExerciseLog.created_at.desc())
        .limit(8)
    )
    exercises = result.scalars().all()
    return [
        {
            "exercise_type": item.exercise_type,
            "exercise_date": str(item.exercise_date),
            "duration_minutes": item.duration_minutes,
            "calories_burned_kcal": float(item.calories_burned_kcal or 0),
            "notes": item.notes,
            "ai_summary": item.ai_summary,
        }
        for item in exercises
    ]
