"""Recipe Agent: recommends personalized meals."""
from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)

RECIPE_SYSTEM_PROMPT = """你是一位专业的食谱推荐师。根据用户的健康目标、当前热量预算和饮食偏好，推荐合适的餐食。

推荐要求：
1. 推荐的食物要具体，包含食材和大致份量
2. 标注预估热量和三大营养素
3. 考虑用户的口味偏好和忌口
4. 推荐要实用，是普通人容易做到或买到的
5. 使用中文回答"""


async def recommend_recipe(
    user_profile: dict,
    daily_summary: dict,
    user_request: str,
) -> str:
    """Generate personalized recipe recommendation."""
    remaining_cal = daily_summary.get("calorie_remaining", 800)

    context = f"""用户画像：
- 目标：{user_profile.get('goal_type', '未设置')}
- 每日热量目标：{user_profile.get('daily_calorie_target', 2000)} kcal
- 口味偏好：{user_profile.get('taste_preference', '无特殊偏好')}
- 忌口/过敏：{user_profile.get('allergies', '无')}
- 饮食限制：{user_profile.get('dietary_restrictions', '无')}

今日剩余热量预算：{remaining_cal} kcal
已摄入热量：{daily_summary.get('total_calories_kcal', 0)} kcal

用户要求：{user_request}"""

    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": RECIPE_SYSTEM_PROMPT},
            {"role": "user", "content": context},
        ],
        temperature=0.8,
        max_tokens=600,
    )
    return response.choices[0].message.content.strip()
