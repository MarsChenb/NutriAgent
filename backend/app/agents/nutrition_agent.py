"""Nutrition Agent: analyzes meals and provides dietary advice."""
from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)

NUTRITION_SYSTEM_PROMPT = """你是一位专业的AI营养师。你需要根据用户的饮食记录和个人画像，给出营养分析和建议。

分析要点：
1. 热量是否合理（对比每日目标）
2. 三大营养素比例是否均衡（蛋白质15-25%、脂肪20-30%、碳水45-55%）
3. 是否符合用户的健康目标（减脂/增肌/维持）
4. 具体可行的改善建议

回答要简洁、实用、有针对性，使用中文。"""


async def analyze_nutrition(
    meal_info: str,
    user_profile: dict,
    daily_summary: dict,
) -> str:
    """Analyze meal nutrition and provide advice."""
    context = f"""用户画像：
- 目标：{user_profile.get('goal_type', '未设置')}
- 每日热量目标：{user_profile.get('daily_calorie_target', 2000)} kcal
- 体重：{user_profile.get('current_weight_kg', '未知')} kg
- 活动水平：{user_profile.get('activity_level', '未知')}

今日摄入汇总：
- 已摄入热量：{daily_summary.get('total_calories_kcal', 0)} kcal
- 蛋白质：{daily_summary.get('total_protein_g', 0)} g
- 脂肪：{daily_summary.get('total_fat_g', 0)} g
- 碳水：{daily_summary.get('total_carb_g', 0)} g
- 剩余热量：{daily_summary.get('calorie_remaining', 0)} kcal

用户输入/本餐信息：
{meal_info}"""

    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": NUTRITION_SYSTEM_PROMPT},
            {"role": "user", "content": context},
        ],
        temperature=0.7,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()
