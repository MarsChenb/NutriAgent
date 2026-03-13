from pydantic import BaseModel


class FoodItemResponse(BaseModel):
    id: int
    food_name: str
    alias_names: str | None
    category: str | None
    source: str | None

    model_config = {"from_attributes": True}


class FoodNutritionResponse(BaseModel):
    food_id: int
    food_name: str
    category: str | None
    serving_basis: str
    calories_kcal: float | None
    protein_g: float | None
    fat_g: float | None
    carb_g: float | None
    fiber_g: float | None

    model_config = {"from_attributes": True}
