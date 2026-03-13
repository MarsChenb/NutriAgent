"""Food Parser: converts natural language meal descriptions to structured food items."""
import json

from openai import AsyncOpenAI
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.food import FoodItem, FoodNutrition

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)

PARSER_SYSTEM_PROMPT = """你是一个食物解析助手。用户会描述一顿饭，你需要提取每个食物及其估算重量。

输出严格的JSON数组格式，不要输出其他内容：
[{"food_name": "食物名称", "amount_g": 重量克数, "quantity": 数量, "unit": "单位"}]

常见份量参考：
- 1碗米饭 ≈ 200g
- 1个鸡蛋 ≈ 50g（去壳）
- 1杯牛奶 ≈ 250ml/250g
- 1个馒头 ≈ 100g
- 1份黄焖鸡米饭 ≈ 400g（含饭）
- 1瓶可乐 ≈ 330ml/330g
- 1个鸡腿 ≈ 100g
- 1片全麦面包 ≈ 40g

示例：
用户: "早餐吃了两个鸡蛋一杯牛奶"
输出: [{"food_name": "鸡蛋（煮）", "amount_g": 100, "quantity": 2, "unit": "个"}, {"food_name": "牛奶", "amount_g": 250, "quantity": 1, "unit": "杯"}]
"""


async def parse_meal_text(text: str) -> list[dict]:
    """Parse meal description text into structured food items."""
    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": PARSER_SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0,
        max_tokens=500,
    )
    content = response.choices[0].message.content.strip()

    # Extract JSON from response (handle markdown code blocks)
    if "```" in content:
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return []


async def resolve_foods(parsed_items: list[dict], db: AsyncSession) -> list[dict]:
    """Match parsed food names against the food database."""
    resolved = []
    for item in parsed_items:
        food_name = item.get("food_name", "")
        amount_g = item.get("amount_g", 100)

        # Fuzzy search
        pattern = f"%{food_name.replace('（', '%').replace('）', '%')}%"
        result = await db.execute(
            select(FoodItem, FoodNutrition)
            .join(FoodNutrition, FoodItem.id == FoodNutrition.food_id)
            .where(
                or_(
                    FoodItem.food_name.ilike(pattern),
                    FoodItem.alias_names.ilike(f"%{food_name}%"),
                )
            )
            .limit(1)
        )
        row = result.first()

        if row:
            food, nutr = row
            scale = amount_g / 100
            resolved.append({
                "food_name": food.food_name,
                "food_id": food.id,
                "amount_g": amount_g,
                "unit": item.get("unit"),
                "quantity": item.get("quantity"),
                "calories_kcal": round(float(nutr.calories_kcal or 0) * scale, 2),
                "protein_g": round(float(nutr.protein_g or 0) * scale, 2),
                "fat_g": round(float(nutr.fat_g or 0) * scale, 2),
                "carb_g": round(float(nutr.carb_g or 0) * scale, 2),
            })
        else:
            resolved.append({
                "food_name": food_name,
                "food_id": None,
                "amount_g": amount_g,
                "unit": item.get("unit"),
                "quantity": item.get("quantity"),
                "calories_kcal": None,
                "protein_g": None,
                "fat_g": None,
                "carb_g": None,
            })

    return resolved
