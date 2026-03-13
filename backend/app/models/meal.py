from datetime import date, datetime

from sqlalchemy import BigInteger, Date, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class MealLog(Base):
    __tablename__ = "meal_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    meal_type: Mapped[str | None] = mapped_column(String(32))  # breakfast/lunch/dinner/snack
    meal_date: Mapped[date] = mapped_column(Date, nullable=False)
    input_mode: Mapped[str | None] = mapped_column(String(32))  # text/image/manual
    raw_input: Mapped[str | None] = mapped_column(Text)
    total_calories_kcal: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_protein_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_fat_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_carb_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    ai_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())


class MealLogItem(Base):
    __tablename__ = "meal_log_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    meal_log_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    food_id: Mapped[int | None] = mapped_column(BigInteger)
    recognized_name: Mapped[str | None] = mapped_column(String(255))
    amount_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    amount_text: Mapped[str | None] = mapped_column(String(64))
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 2))
    calories_kcal: Mapped[float | None] = mapped_column(Numeric(8, 2))
    protein_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    fat_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    carb_g: Mapped[float | None] = mapped_column(Numeric(8, 2))


class DailyNutritionSummary(Base):
    __tablename__ = "daily_nutrition_summary"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_calories_kcal: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_protein_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_fat_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_carb_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    meals_count: Mapped[int] = mapped_column(Integer, default=0)
    calorie_remaining_kcal: Mapped[float | None] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
