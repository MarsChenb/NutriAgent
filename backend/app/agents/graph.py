"""Main workflow for the AI coach workspace."""
import re
from datetime import date

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.coach_personas import get_coach_persona
from app.agents.food_parser import parse_meal_text, resolve_foods
from app.agents.nutrition_agent import analyze_nutrition
from app.agents.recipe_agent import recommend_recipe
from app.agents.router_agent import classify_intent
from app.agents.sql_agent import (
    get_daily_intake,
    get_recent_exercises,
    get_recent_meals,
    lookup_food_nutrition,
)
from app.config import settings
from app.models.user import UserProfile
from app.services.meal_service import create_meal

llm_client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


def _normalize_goal(goal_type: str | None) -> str:
    mapping = {
        "fat_loss": "减脂塑形",
        "health": "更健康",
        "energy": "更有活力",
        "detox": "饮食重置",
    }
    return mapping.get(goal_type or "", "未设置")


def _build_recent_meals_text(recent_meals: list[dict]) -> str:
    if not recent_meals:
        return "最近暂无餐食记录"
    lines = []
    for meal in recent_meals[:5]:
        items_text = "、".join(item["name"] for item in meal["items"] if item.get("name")) or "未命名餐食"
        lines.append(f"- {meal['meal_date']} {meal['meal_type']}: {items_text}，{meal['total_calories_kcal']:.0f} kcal")
    return "\n".join(lines)


def _build_recent_exercises_text(recent_exercises: list[dict]) -> str:
    if not recent_exercises:
        return "最近暂无运动记录"
    lines = []
    for item in recent_exercises[:4]:
        lines.append(
            f"- {item['exercise_date']} {item['exercise_type']} {item['duration_minutes']} 分钟，消耗 {item['calories_burned_kcal']:.0f} kcal"
        )
    return "\n".join(lines)


def _build_context_snapshot(user_profile: dict, daily_summary: dict, recent_meals: list[dict], recent_exercises: list[dict]) -> dict:
    return {
        "goal": _normalize_goal(user_profile.get("goal_type")),
        "coach_persona": user_profile.get("coach_persona") or "mira",
        "calorie_target": daily_summary.get("calorie_target", 2000),
        "calorie_remaining": daily_summary.get("calorie_remaining", 0),
        "calorie_deficit": daily_summary.get("calorie_deficit", 0),
        "recent_meals_count": len(recent_meals),
        "recent_exercises_count": len(recent_exercises),
    }


def _extract_food_keyword(user_input: str) -> str:
    cleaned = user_input.strip()
    replacements = [
        "帮我查", "查一下", "查一查", "热量", "卡路里", "是多少", "有多少", "请问", "营养", "三大营养素",
    ]
    for token in replacements:
        cleaned = cleaned.replace(token, "")
    cleaned = re.sub(r"[?？。，,.!！:：]", "", cleaned).strip()
    return cleaned or user_input.strip()


async def _load_user_context(db: AsyncSession, user_id: int) -> tuple[dict, dict, list[dict], list[dict]]:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    user_profile: dict = {}
    if profile:
        user_profile = {
            "coach_persona": profile.coach_persona,
            "goal_type": profile.goal_type,
            "daily_calorie_target": profile.daily_calorie_target,
            "current_weight_kg": float(profile.current_weight_kg) if profile.current_weight_kg else None,
            "target_weight_kg": float(profile.target_weight_kg) if profile.target_weight_kg else None,
            "activity_level": profile.activity_level,
            "taste_preference": profile.taste_preference,
            "allergies": profile.allergies,
            "dietary_restrictions": profile.dietary_restrictions,
            "medical_history": profile.medical_history,
        }

    daily_summary = await get_daily_intake(db, user_id)
    recent_meals = await get_recent_meals(db, user_id, days=2)
    recent_exercises = await get_recent_exercises(db, user_id, days=3)
    return user_profile, daily_summary, recent_meals, recent_exercises


async def _chat_with_context(
    user_input: str,
    coach_persona_id: str | None,
    user_profile: dict,
    daily_summary: dict,
    recent_meals: list[dict],
    recent_exercises: list[dict],
    task_instruction: str,
) -> str:
    coach = get_coach_persona(coach_persona_id)
    system_prompt = f"""你是 NutriAgent 的 AI 私教，当前教练人格是 {coach.name}，风格为{coach.style}。
{coach.system_tone}
你的回答必须结合用户画像、今日热量预算、最近餐食记录和最近运动记录来给建议。
{task_instruction}
回答要求：
1. 先给最关键结论
2. 再给 2-4 条可执行建议
3. 如果和用户今天剩余热量相关，要明确写出还能怎么吃或该收哪里
4. 不要假装看到了没有提供的数据"""

    context = f"""用户画像：
- 目标：{_normalize_goal(user_profile.get('goal_type'))}
- 每日热量目标：{user_profile.get('daily_calorie_target', 2000)} kcal
- 当前体重：{user_profile.get('current_weight_kg', '未知')} kg
- 目标体重：{user_profile.get('target_weight_kg', '未知')} kg
- 活动水平：{user_profile.get('activity_level', '未知')}
- 口味偏好：{user_profile.get('taste_preference', '无特殊偏好')}
- 过敏/忌口：{user_profile.get('allergies', '无')}
- 饮食限制：{user_profile.get('dietary_restrictions', '无')}
- 健康史：{user_profile.get('medical_history', '无')}

今日摘要：
- 已摄入：{daily_summary.get('total_calories_kcal', 0)} kcal
- 已消耗：{daily_summary.get('total_exercise_calories_kcal', 0)} kcal
- 剩余预算：{daily_summary.get('calorie_remaining', 0)} kcal
- 当前热量缺口：{daily_summary.get('calorie_deficit', 0)} kcal

最近餐食：
{_build_recent_meals_text(recent_meals)}

最近运动：
{_build_recent_exercises_text(recent_exercises)}

用户问题：{user_input}"""

    response = await llm_client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context},
        ],
        temperature=0.7,
        max_tokens=700,
    )
    return response.choices[0].message.content.strip()


async def run_agent(user_input: str, user_id: int, db: AsyncSession) -> dict:
    intent = await classify_intent(user_input)
    user_profile, daily_summary, recent_meals, recent_exercises = await _load_user_context(db, user_id)
    coach_persona_id = user_profile.get("coach_persona")

    if intent == "log_meal":
        response = await _handle_log_meal(user_input, user_id, user_profile, daily_summary, db)
    elif intent == "lookup_food":
        response = await _handle_lookup_food(user_input, db, coach_persona_id)
    elif intent == "query_nutrition":
        response = await _chat_with_context(
            user_input,
            coach_persona_id,
            user_profile,
            daily_summary,
            recent_meals,
            recent_exercises,
            "你当前的任务是回答与今日热量预算、还剩多少能吃什么、如何保持缺口相关的问题。",
        )
    elif intent == "ask_knowledge":
        response = await _handle_ask_knowledge(
            user_input,
            user_profile,
            daily_summary,
            recent_meals,
            recent_exercises,
            db,
        )
    elif intent == "recommend_recipe":
        response = await recommend_recipe(user_profile, daily_summary, user_input, coach_persona_id)
    else:
        response = await _chat_with_context(
            user_input,
            coach_persona_id,
            user_profile,
            daily_summary,
            recent_meals,
            recent_exercises,
            "你当前的任务是作为长期陪伴型 AI 私教回答用户，适度引导用户继续记录、执行和复盘。",
        )

    return {
        "response": response,
        "intent": intent,
        "context_snapshot": _build_context_snapshot(user_profile, daily_summary, recent_meals, recent_exercises),
    }


async def _handle_log_meal(user_input: str, user_id: int, user_profile: dict, daily_summary: dict, db: AsyncSession) -> str:
    parsed_items = await parse_meal_text(user_input)
    if not parsed_items:
        return "我还没识别出具体食物。你可以把这一餐写得更具体一点，比如食物名称和大概分量。"

    resolved_items = await resolve_foods(parsed_items, db)
    valid_items = [item for item in resolved_items if item.get("food_id")]
    if valid_items:
        meal_items = [{"food_id": item["food_id"], "amount_g": item["amount_g"]} for item in valid_items]
        await create_meal(
            db=db,
            user_id=user_id,
            meal_type="lunch",
            meal_date=date.today(),
            items=meal_items,
            input_mode="text",
            raw_input=user_input,
        )

    total_cal = sum(item.get("calories_kcal", 0) or 0 for item in resolved_items)
    meal_info = "\n".join(
        f"- {item['food_name']} {item['amount_g']}g，约 {item.get('calories_kcal', 0):.0f} kcal"
        for item in resolved_items
    )
    updated_summary = await get_daily_intake(db, user_id)
    analysis = await analyze_nutrition(
        meal_info=f"刚记录的一餐：\n{meal_info}\n本餐合计：{total_cal:.0f} kcal",
        user_profile=user_profile,
        daily_summary=updated_summary,
        coach_persona_id=user_profile.get("coach_persona"),
    )
    return (
        f"已帮你记录这餐：\n{meal_info}\n\n"
        f"本餐合计约 {total_cal:.0f} kcal。今天还剩 {updated_summary['calorie_remaining']:.0f} kcal 预算。\n\n"
        f"我的建议：\n{analysis}"
    )


async def _handle_lookup_food(user_input: str, db: AsyncSession, coach_persona_id: str | None) -> str:
    coach = get_coach_persona(coach_persona_id)
    keyword = _extract_food_keyword(user_input)
    results = await lookup_food_nutrition(db, keyword)
    if not results:
        return f"我暂时没在食物库里找到“{keyword}”。你可以换个更常见的名称，或者告诉我品牌/做法再试一次。"

    lines = []
    for item in results[:3]:
        lines.append(
            f"- {item['food_name']}：每 100g 约 {item['calories_kcal']:.0f} kcal，蛋白质 {item['protein_g']:.1f}g，脂肪 {item['fat_g']:.1f}g，碳水 {item['carb_g']:.1f}g"
        )
    tip = {
        "理性拆解型": "如果你告诉我实际吃了多少克，我可以继续帮你换算整份热量。",
        "陪伴鼓励型": "不用一次记得很准，先知道大概范围就已经很有帮助。",
        "直接推进型": "下一步直接告诉我你吃了多少克，我给你算整份。",
    }.get(coach.style, "如果你告诉我实际分量，我可以继续帮你换算整份热量。")
    return f"我帮你查到了“{keyword}”的参考营养值：\n" + "\n".join(lines) + f"\n\n{tip}"


async def _handle_ask_knowledge(
    user_input: str,
    user_profile: dict,
    daily_summary: dict,
    recent_meals: list[dict],
    recent_exercises: list[dict],
    db: AsyncSession,
) -> str:
    from app.rag.retriever import retrieve_relevant_chunks

    coach_persona_id = user_profile.get("coach_persona")
    coach = get_coach_persona(coach_persona_id)
    chunks = await retrieve_relevant_chunks(db, user_input, top_k=5)
    rag_context = "\n\n".join(chunk["text"] for chunk in chunks) if chunks else "无明确检索结果"
    sources = sorted({chunk["source"] for chunk in chunks}) if chunks else []

    answer = await _chat_with_context(
        user_input,
        coach_persona_id,
        user_profile,
        daily_summary,
        recent_meals,
        recent_exercises,
        f"你当前的任务是回答训练后饮食、减脂饮食原则、营养知识等问题。检索知识如下：\n{rag_context}\n如果检索结果不足，可以基于常识回答，但要避免编造具体研究结论。",
    )
    if sources:
        answer += f"\n\n参考来源：{', '.join(sources)}"
    return answer
