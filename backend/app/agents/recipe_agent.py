"""Recipe Agent: recommends personalized meals."""
from openai import AsyncOpenAI

from app.agents.coach_personas import get_coach_persona
from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


async def recommend_recipe(
    user_profile: dict,
    daily_summary: dict,
    user_request: str,
    coach_persona_id: str | None = None,
) -> str:
    coach = get_coach_persona(coach_persona_id)
    remaining_cal = daily_summary.get("calorie_remaining", 800)

    system_prompt = f"""你是一位专业的 AI 饮食教练，当前教练人格是 {coach.name}，风格为{coach.style}。
{coach.system_tone}
请根据用户画像、当前热量预算和用户要求，推荐具体可执行的一餐或一个饮食方案。
要求：
1. 推荐的食物要具体，给出大致份量
2. 标注预估热量和三大营养素侧重点
3. 优先推荐普通人容易买到或做得到的方案
4. 回答尽量围绕“现在就能怎么做”
请使用中文回答。"""

    context = f"""用户画像：
- 目标：{user_profile.get('goal_type', '未设置')}
- 每日热量目标：{user_profile.get('daily_calorie_target', 2000)} kcal
- 口味偏好：{user_profile.get('taste_preference', '无特殊偏好')}
- 过敏/忌口：{user_profile.get('allergies', '无')}
- 饮食限制：{user_profile.get('dietary_restrictions', '无')}

今日状态：
- 已摄入热量：{daily_summary.get('total_calories_kcal', 0)} kcal
- 已消耗热量：{daily_summary.get('total_exercise_calories_kcal', 0)} kcal
- 剩余预算：{remaining_cal} kcal
- 热量缺口：{daily_summary.get('calorie_deficit', 0)} kcal

用户要求：{user_request}"""

    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context},
        ],
        temperature=0.75,
        max_tokens=550,
    )
    return response.choices[0].message.content.strip()
