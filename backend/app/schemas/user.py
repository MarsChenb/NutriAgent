from datetime import datetime

from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    nickname: str | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    nickname: str | None
    gender: str | None
    height_cm: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    current_weight_kg: float | None = None
    target_weight_kg: float | None = None
    goal_type: str | None = None
    activity_level: str | None = None
    daily_calorie_target: int | None = None
    protein_target_g: float | None = None
    fat_target_g: float | None = None
    carb_target_g: float | None = None
    taste_preference: str | None = None
    allergies: str | None = None
    dietary_restrictions: str | None = None


class UserProfileResponse(BaseModel):
    user_id: int
    current_weight_kg: float | None
    target_weight_kg: float | None
    goal_type: str | None
    activity_level: str | None
    daily_calorie_target: int | None
    protein_target_g: float | None
    fat_target_g: float | None
    carb_target_g: float | None
    taste_preference: str | None
    allergies: str | None
    dietary_restrictions: str | None

    model_config = {"from_attributes": True}
