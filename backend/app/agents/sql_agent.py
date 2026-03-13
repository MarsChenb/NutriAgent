"""SQL Agent: queries food nutrition and user meal data."""
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem, FoodNutrition
from app.models.meal import DailyNutritionSummary, MealLog, MealLogItem
from app.models.user import UserProfile


async def lookup_food_nutrition(db: AsyncSession, food_name: str) -> list[dict]:
    """Look up food nutrition by name."""
    from sqlalchemy import or_
    pattern = f"%{food_name}%"
    result = await db.execute(
        select(FoodItem, FoodNutrition)
        .join(FoodNutrition, FoodItem.id == FoodNutrition.food_id)
        .where(or_(
            FoodItem.food_name.ilike(pattern),
            FoodItem.alias_names.ilike(pattern),
        ))
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


async def get_daily_intake(db: AsyncSession, user_id: int, target_date: date = None) -> dict:
    """Get user's daily nutrition intake."""
    target_date = target_date or date.today()
    result = await db.execute(
        select(DailyNutritionSummary).where(
            DailyNutritionSummary.user_id == user_id,
            DailyNutritionSummary.summary_date == target_date,
        )
    )
    summary = result.scalar_one_or_none()

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    target = profile.daily_calorie_target if profile else 2000

    if summary:
        return {
            "date": str(target_date),
            "total_calories_kcal": float(summary.total_calories_kcal or 0),
            "total_protein_g": float(summary.total_protein_g or 0),
            "total_fat_g": float(summary.total_fat_g or 0),
            "total_carb_g": float(summary.total_carb_g or 0),
            "meals_count": summary.meals_count,
            "calorie_target": target,
            "calorie_remaining": float(summary.calorie_remaining_kcal or 0),
        }
    return {
        "date": str(target_date),
        "total_calories_kcal": 0,
        "total_protein_g": 0,
        "total_fat_g": 0,
        "total_carb_g": 0,
        "meals_count": 0,
        "calorie_target": target,
        "calorie_remaining": float(target or 2000),
    }


async def get_recent_meals(db: AsyncSession, user_id: int, days: int = 1) -> list[dict]:
    """Get user's recent meal records."""
    from datetime import timedelta
    start_date = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(MealLog).where(
            MealLog.user_id == user_id,
            MealLog.meal_date >= start_date,
        ).order_by(MealLog.created_at.desc()).limit(10)
    )
    meals = result.scalars().all()
    output = []
    for meal in meals:
        items_result = await db.execute(
            select(MealLogItem).where(MealLogItem.meal_log_id == meal.id)
        )
        items = items_result.scalars().all()
        output.append({
            "meal_type": meal.meal_type,
            "meal_date": str(meal.meal_date),
            "total_calories_kcal": float(meal.total_calories_kcal or 0),
            "items": [
                {"name": item.recognized_name, "amount_g": float(item.amount_g or 0),
                 "calories_kcal": float(item.calories_kcal or 0)}
                for item in items
            ],
        })
    return output
