"""Load seed data into the database."""
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.models import Base
from app.models.user import User, UserProfile, WeightLog  # noqa: F401
from app.models.food import FoodItem, FoodNutrition
from app.models.meal import MealLog, MealLogItem, DailyNutritionSummary  # noqa: F401
from app.models.recipe import Recipe, RecipeIngredient  # noqa: F401
from app.models.memory import LongTermMemory, ConversationHistory  # noqa: F401
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk  # noqa: F401

SEEDS_DIR = Path(__file__).resolve().parent


async def ensure_pgvector(engine):
    """Ensure the pgvector extension is enabled."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


async def create_tables(engine):
    """Create all tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def load_chinese_foods(session: AsyncSession):
    """Load Chinese foods seed data."""
    foods_file = SEEDS_DIR / "chinese_foods.json"
    with open(foods_file, "r", encoding="utf-8") as f:
        foods_data = json.load(f)

    count = 0
    for food in foods_data:
        # Check if food already exists
        result = await session.execute(
            select(FoodItem).where(FoodItem.food_name == food["food_name"])
        )
        if result.scalar_one_or_none():
            continue

        food_item = FoodItem(
            food_name=food["food_name"],
            alias_names=food.get("alias_names"),
            category=food.get("category"),
            default_unit="g",
            source=food.get("source", "通用"),
        )
        session.add(food_item)
        await session.flush()

        nutrition = FoodNutrition(
            food_id=food_item.id,
            serving_basis="100g",
            calories_kcal=food.get("calories_kcal"),
            protein_g=food.get("protein_g"),
            fat_g=food.get("fat_g"),
            carb_g=food.get("carb_g"),
            fiber_g=food.get("fiber_g"),
        )
        session.add(nutrition)
        count += 1

    await session.commit()
    print(f"Loaded {count} food items.")


async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    await ensure_pgvector(engine)
    await create_tables(engine)

    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_factory() as session:
        await load_chinese_foods(session)

    await engine.dispose()
    print("Seed data loaded successfully!")


if __name__ == "__main__":
    asyncio.run(main())
