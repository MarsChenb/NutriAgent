"""Nutrition Agent: analyzes meals and provides dietary advice."""
from openai import AsyncOpenAI

from app.agents.coach_personas import get_coach_persona
from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


async def analyze_nutrition(
    meal_info: str,
    user_profile: dict,
    daily_summary: dict,
    coach_persona_id: str | None = None,
) -> str:
    coach = get_coach_persona(coach_persona_id)
    system_prompt = f"""你是一位专业的 AI 营养教练，当前教练人格是 {coach.name}，风格为{coach.style}。
{coach.system_tone}
你需要根据用户的饮食记录和个人画像，给出简洁、可执行、有针对性的营养分析。
分析重点：
1. 这餐和全天热量是否合理
2. 蛋白质、脂肪、碳水是否平衡
3. 是否符合用户当前目标
4. 下一餐或今天剩余时间最值得调整的一件事
请使用中文回答。"""

    context = f"""用户画像：
- 目标：{user_profile.get('goal_type', '未设置')}
- 每日热量目标：{user_profile.get('daily_calorie_target', 2000)} kcal
- 当前体重：{user_profile.get('current_weight_kg', '未知')} kg
- 活动水平：{user_profile.get('activity_level', '未知')}

今日汇总：
- 已摄入热量：{daily_summary.get('total_calories_kcal', 0)} kcal
- 已消耗热量：{daily_summary.get('total_exercise_calories_kcal', 0)} kcal
- 剩余预算：{daily_summary.get('calorie_remaining', 0)} kcal
- 热量缺口：{daily_summary.get('calorie_deficit', 0)} kcal

本餐信息：
{meal_info}"""

    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context},
        ],
        temperature=0.6,
        max_tokens=450,
    )
    return response.choices[0].message.content.strip()
