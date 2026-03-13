from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.food import FoodItem, FoodNutrition
from app.schemas.food import FoodNutritionResponse

router = APIRouter(prefix="/foods", tags=["食物"])


@router.get("/", response_model=list[FoodNutritionResponse])
async def search_foods(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    """搜索食物，返回营养信息"""
    pattern = f"%{q}%"
    result = await db.execute(
        select(FoodItem, FoodNutrition)
        .join(FoodNutrition, FoodItem.id == FoodNutrition.food_id)
        .where(
            or_(
                FoodItem.food_name.ilike(pattern),
                FoodItem.alias_names.ilike(pattern),
            )
        )
        .limit(limit)
    )
    rows = result.all()
    return [
        FoodNutritionResponse(
            food_id=food.id,
            food_name=food.food_name,
            category=food.category,
            serving_basis=nutr.serving_basis,
            calories_kcal=float(nutr.calories_kcal or 0),
            protein_g=float(nutr.protein_g or 0),
            fat_g=float(nutr.fat_g or 0),
            carb_g=float(nutr.carb_g or 0),
            fiber_g=float(nutr.fiber_g or 0),
        )
        for food, nutr in rows
    ]


@router.get("/{food_id}", response_model=FoodNutritionResponse)
async def get_food(food_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个食物的营养信息"""
    result = await db.execute(
        select(FoodItem, FoodNutrition)
        .join(FoodNutrition, FoodItem.id == FoodNutrition.food_id)
        .where(FoodItem.id == food_id)
    )
    row = result.first()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="食物不存在")
    food, nutr = row
    return FoodNutritionResponse(
        food_id=food.id,
        food_name=food.food_name,
        category=food.category,
        serving_basis=nutr.serving_basis,
        calories_kcal=float(nutr.calories_kcal or 0),
        protein_g=float(nutr.protein_g or 0),
        fat_g=float(nutr.fat_g or 0),
        carb_g=float(nutr.carb_g or 0),
        fiber_g=float(nutr.fiber_g or 0),
    )
