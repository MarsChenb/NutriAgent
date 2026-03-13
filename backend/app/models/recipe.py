from datetime import datetime

from sqlalchemy import BigInteger, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recipe_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recipe_type: Mapped[str | None] = mapped_column(String(64))  # 早餐/午餐/晚餐/加餐
    goal_type: Mapped[str | None] = mapped_column(String(32))  # 减脂/增肌/控糖
    total_calories_kcal: Mapped[float | None] = mapped_column(Numeric(8, 2))
    protein_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    fat_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    carb_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    instructions: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=func.now())


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recipe_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    food_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    amount_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    amount_text: Mapped[str | None] = mapped_column(String(64))
