from datetime import date

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies import get_current_user
from app.models.meal import MealLog, MealLogItem
from app.models.user import User
from app.schemas.meal import (
    DailySummaryResponse,
    MealCreateRequest,
    MealItemResponse,
    MealLogResponse,
    MealParseRequest,
    MealParseResponse,
)
from app.services.meal_service import create_meal, get_daily_summary

router = APIRouter(prefix="/meals", tags=["饮食记录"])


@router.post("/", response_model=MealLogResponse)
async def create_meal_log(
    data: MealCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建饮食记录"""
    meal_date = data.meal_date or date.today()
    items = [{"food_id": item.food_id, "amount_g": item.amount_g, "amount_text": item.amount_text} for item in data.items]

    meal_log = await create_meal(
        db=db,
        user_id=user.id,
        meal_type=data.meal_type,
        meal_date=meal_date,
        items=items,
        input_mode="manual",
        raw_input=data.raw_input,
    )

    # Load items for response
    items_result = await db.execute(
        select(MealLogItem).where(MealLogItem.meal_log_id == meal_log.id)
    )
    meal_items = items_result.scalars().all()

    return MealLogResponse(
        id=meal_log.id,
        meal_type=meal_log.meal_type,
        meal_date=meal_log.meal_date,
        input_mode=meal_log.input_mode,
        total_calories_kcal=float(meal_log.total_calories_kcal or 0),
        total_protein_g=float(meal_log.total_protein_g or 0),
        total_fat_g=float(meal_log.total_fat_g or 0),
        total_carb_g=float(meal_log.total_carb_g or 0),
        ai_summary=meal_log.ai_summary,
        created_at=meal_log.created_at,
        items=[MealItemResponse.model_validate(item) for item in meal_items],
    )


@router.get("/", response_model=list[MealLogResponse])
async def list_meals(
    meal_date: date = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取饮食记录列表"""
    query = select(MealLog).where(MealLog.user_id == user.id)
    if meal_date:
        query = query.where(MealLog.meal_date == meal_date)
    query = query.order_by(MealLog.created_at.desc()).limit(20)

    result = await db.execute(query)
    meals = result.scalars().all()

    responses = []
    for meal in meals:
        items_result = await db.execute(
            select(MealLogItem).where(MealLogItem.meal_log_id == meal.id)
        )
        items = items_result.scalars().all()
        responses.append(
            MealLogResponse(
                id=meal.id,
                meal_type=meal.meal_type,
                meal_date=meal.meal_date,
                input_mode=meal.input_mode,
                total_calories_kcal=float(meal.total_calories_kcal or 0),
                total_protein_g=float(meal.total_protein_g or 0),
                total_fat_g=float(meal.total_fat_g or 0),
                total_carb_g=float(meal.total_carb_g or 0),
                ai_summary=meal.ai_summary,
                created_at=meal.created_at,
                items=[MealItemResponse.model_validate(item) for item in items],
            )
        )
    return responses


@router.get("/daily-summary", response_model=DailySummaryResponse)
async def daily_summary(
    summary_date: date = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取每日营养汇总"""
    target_date = summary_date or date.today()
    summary = await get_daily_summary(db, user.id, target_date)
    return DailySummaryResponse(**summary)


@router.delete("/{meal_id}")
async def delete_meal(
    meal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除饮食记录"""
    result = await db.execute(
        select(MealLog).where(MealLog.id == meal_id, MealLog.user_id == user.id)
    )
    meal = result.scalar_one_or_none()
    if not meal:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="记录不存在")

    # Delete items first
    items_result = await db.execute(
        select(MealLogItem).where(MealLogItem.meal_log_id == meal_id)
    )
    for item in items_result.scalars().all():
        await db.delete(item)

    meal_date = meal.meal_date
    await db.delete(meal)

    # Recalculate daily summary
    from app.services.meal_service import update_daily_summary
    await update_daily_summary(db, user.id, meal_date)
    await db.commit()

    return {"message": "删除成功"}


@router.post("/parse", response_model=MealParseResponse)
async def parse_meal_text_endpoint(
    data: MealParseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI 解析文字饮食描述"""
    from fastapi import HTTPException
    from app.agents.food_parser import parse_meal_text, resolve_foods

    try:
        parsed = await parse_meal_text(data.text)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI 解析服务不可用：{str(e)[:200]}")

    resolved = await resolve_foods(parsed, db)

    total_cal = sum(item.get("calories_kcal", 0) or 0 for item in resolved)
    total_protein = sum(item.get("protein_g", 0) or 0 for item in resolved)
    total_fat = sum(item.get("fat_g", 0) or 0 for item in resolved)
    total_carb = sum(item.get("carb_g", 0) or 0 for item in resolved)

    from app.schemas.meal import ParsedFoodItem
    items = [ParsedFoodItem(**item) for item in resolved]

    return MealParseResponse(
        items=items,
        total_calories_kcal=round(total_cal, 2),
        total_protein_g=round(total_protein, 2),
        total_fat_g=round(total_fat, 2),
        total_carb_g=round(total_carb, 2),
    )


@router.post("/image")
async def upload_meal_image(
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传餐食图片，AI 识别食物"""
    from app.vision.food_recognizer import recognize_food_from_image
    from app.agents.food_parser import resolve_foods

    image_bytes = await image.read()
    recognized = await recognize_food_from_image(image_bytes)

    if recognized and "error" in recognized[0]:
        return {"error": recognized[0]["error"], "items": []}

    # Convert recognized items to the same format as text parser
    parsed_items = [
        {"food_name": item["food_name"], "amount_g": item.get("amount_g", 100)}
        for item in recognized
        if "food_name" in item
    ]

    resolved = await resolve_foods(parsed_items, db)

    total_cal = sum(item.get("calories_kcal", 0) or 0 for item in resolved)

    return {
        "items": resolved,
        "total_calories_kcal": round(total_cal, 2),
    }
