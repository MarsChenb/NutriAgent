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
    coach_persona: str | None = None
    goal_type: str | None = None
    gender: str | None = None
    age: int | None = None
    height_cm: float | None = None
    current_weight_kg: float | None = None
    target_weight_kg: float | None = None
    body_shape: str | None = None
    activity_level: str | None = None
    medical_history: str | None = None
    onboarding_completed: bool | None = None
    daily_calorie_target: int | None = None
    protein_target_g: float | None = None
    fat_target_g: float | None = None
    carb_target_g: float | None = None
    taste_preference: str | None = None
    allergies: str | None = None
    dietary_restrictions: str | None = None


class UserProfileResponse(BaseModel):
    user_id: int
    coach_persona: str | None
    goal_type: str | None
    gender: str | None
    age: int | None
    height_cm: float | None
    current_weight_kg: float | None
    target_weight_kg: float | None
    body_shape: str | None
    activity_level: str | None
    medical_history: str | None
    onboarding_completed: bool
    daily_calorie_target: int | None
    protein_target_g: float | None
    fat_target_g: float | None
    carb_target_g: float | None
    taste_preference: str | None
    allergies: str | None
    dietary_restrictions: str | None
    bmi: float | None
    weight_delta_kg: float | None

    model_config = {"from_attributes": True}
