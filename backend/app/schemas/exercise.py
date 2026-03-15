from datetime import date, datetime

from pydantic import BaseModel


class ExerciseCreateRequest(BaseModel):
    exercise_type: str
    exercise_date: date | None = None
    duration_minutes: int
    calories_burned_kcal: float
    notes: str | None = None


class ExerciseLogResponse(BaseModel):
    id: int
    exercise_type: str
    exercise_date: date
    duration_minutes: int
    calories_burned_kcal: float
    notes: str | None
    ai_summary: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
