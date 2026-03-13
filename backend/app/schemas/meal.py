from datetime import date, datetime

from pydantic import BaseModel


class MealItemInput(BaseModel):
    food_id: int
    amount_g: float
    amount_text: str | None = None


class MealCreateRequest(BaseModel):
    meal_type: str  # breakfast/lunch/dinner/snack
    meal_date: date | None = None
    items: list[MealItemInput]
    raw_input: str | None = None


class MealParseRequest(BaseModel):
    text: str
    meal_type: str = "lunch"


class ParsedFoodItem(BaseModel):
    food_name: str
    amount_g: float
    unit: str | None = None
    quantity: float | None = None
    food_id: int | None = None
    calories_kcal: float | None = None
    protein_g: float | None = None
    fat_g: float | None = None
    carb_g: float | None = None


class MealParseResponse(BaseModel):
    items: list[ParsedFoodItem]
    total_calories_kcal: float
    total_protein_g: float
    total_fat_g: float
    total_carb_g: float


class MealItemResponse(BaseModel):
    id: int
    food_id: int | None
    recognized_name: str | None
    amount_g: float | None
    calories_kcal: float | None
    protein_g: float | None
    fat_g: float | None
    carb_g: float | None

    model_config = {"from_attributes": True}


class MealLogResponse(BaseModel):
    id: int
    meal_type: str | None
    meal_date: date
    input_mode: str | None
    total_calories_kcal: float | None
    total_protein_g: float | None
    total_fat_g: float | None
    total_carb_g: float | None
    ai_summary: str | None
    created_at: datetime
    items: list[MealItemResponse] = []

    model_config = {"from_attributes": True}


class DailySummaryResponse(BaseModel):
    summary_date: date
    total_calories_kcal: float
    total_protein_g: float
    total_fat_g: float
    total_carb_g: float
    meals_count: int
    calorie_target: int | None = None
    calorie_remaining_kcal: float | None = None
