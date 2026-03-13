from datetime import datetime

from sqlalchemy import BigInteger, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class FoodItem(Base):
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    food_code: Mapped[str | None] = mapped_column(String(64), unique=True)
    food_name: Mapped[str] = mapped_column(String(255), nullable=False)
    alias_names: Mapped[str | None] = mapped_column(Text)  # 逗号分隔的别名
    category: Mapped[str | None] = mapped_column(String(64))  # 主食/肉类/饮料/蔬菜 等
    default_unit: Mapped[str | None] = mapped_column(String(32), default="g")
    source: Mapped[str | None] = mapped_column(String(64))  # USDA / 中国食物成分表
    created_at: Mapped[datetime] = mapped_column(default=func.now())


class FoodNutrition(Base):
    __tablename__ = "food_nutrition"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    food_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    serving_basis: Mapped[str] = mapped_column(String(32), default="100g")
    calories_kcal: Mapped[float | None] = mapped_column(Numeric(8, 2))
    protein_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    fat_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    carb_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    fiber_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    sugar_g: Mapped[float | None] = mapped_column(Numeric(8, 2))
    sodium_mg: Mapped[float | None] = mapped_column(Numeric(8, 2))
    updated_at: Mapped[datetime] = mapped_column(default=func.now())
