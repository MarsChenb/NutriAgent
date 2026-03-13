from datetime import date, datetime

from sqlalchemy import BigInteger, Date, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(100))
    gender: Mapped[str | None] = mapped_column(String(16))
    birth_date: Mapped[date | None] = mapped_column(Date)
    height_cm: Mapped[float | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    current_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2))
    target_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2))
    goal_type: Mapped[str | None] = mapped_column(String(32))  # 减脂/增肌/维持/控糖
    activity_level: Mapped[str | None] = mapped_column(String(32))  # 久坐/轻活动/中活动/高活动
    daily_calorie_target: Mapped[int | None] = mapped_column()
    protein_target_g: Mapped[float | None] = mapped_column(Numeric(6, 2))
    fat_target_g: Mapped[float | None] = mapped_column(Numeric(6, 2))
    carb_target_g: Mapped[float | None] = mapped_column(Numeric(6, 2))
    taste_preference: Mapped[str | None] = mapped_column(String(64))
    allergies: Mapped[str | None] = mapped_column(Text)
    dietary_restrictions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())


class WeightLog(Base):
    __tablename__ = "weight_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    body_fat_rate: Mapped[float | None] = mapped_column(Numeric(5, 2))
    recorded_at: Mapped[datetime] = mapped_column(nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="manual")
