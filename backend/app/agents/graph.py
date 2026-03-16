"""Main workflow for the AI coach workspace."""
from __future__ import annotations

import re
from datetime import date
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.clarifier import (
    detect_clarification_need,
    get_session_key,
    merge_pending_input,
    save_pending_clarification,
)
from app.agents.coach_personas import get_coach_persona
from app.agents.food_parser import parse_meal_text, resolve_foods
from app.agents.nutrition_agent import analyze_nutrition
from app.agents.planner import build_execution_plan
from app.agents.recipe_agent import recommend_recipe
from app.agents.router_agent import classify_intent
from app.agents.sql_agent import (
    get_daily_intake,
    get_recent_exercises,
    get_recent_meals,
    lookup_food_nutrition,
)
from app.agents.tool_registry import ToolDefinition, ToolRegistry
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


def _extract_meal_type(user_input: str) -> str:
    mapping = {
        "早餐": "breakfast",
        "早饭": "breakfast",
        "午餐": "lunch",
        "中午": "lunch",
        "晚餐": "dinner",
        "晚上": "dinner",
        "加餐": "snack",
    }
    for keyword, meal_type in mapping.items():
        if keyword in user_input:
            return meal_type
    return "lunch"


def _coerce_trace_summary(value: Any) -> str:
    if isinstance(value, str):
        return value[:160]
    if isinstance(value, list):
        return f"生成 {len(value)} 条记录"
    if isinstance(value, dict):
        keys = "、".join(list(value.keys())[:5])
        return f"返回字段：{keys}" if keys else "返回结构化数据"
    return str(value)[:160]


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


async def _log_meal_and_collect(user_input: str, user_id: int, user_profile: dict, db: AsyncSession) -> dict[str, Any]:
    parsed_items = await parse_meal_text(user_input)
    if not parsed_items:
        return {
            "status": "no_match",
            "message": "我还没识别出具体食物。你可以把这一餐写得更具体一点，比如食物名称和大概分量。",
            "trace_summary": "没有解析出可记录的餐食项",
        }

    resolved_items = await resolve_foods(parsed_items, db)
    valid_items = [item for item in resolved_items if item.get("food_id")]
    if valid_items:
        meal_items = [{"food_id": item["food_id"], "amount_g": item["amount_g"]} for item in valid_items]
        await create_meal(
            db=db,
            user_id=user_id,
            meal_type=_extract_meal_type(user_input),
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
    message = (
        f"已帮你记录这餐：\n{meal_info}\n\n"
        f"本餐合计约 {total_cal:.0f} kcal。今天还剩 {updated_summary['calorie_remaining']:.0f} kcal 预算。\n\n"
        f"我的建议：\n{analysis}"
    )
    return {
        "status": "ok",
        "message": message,
        "trace_summary": f"记录 {len(valid_items)} 个食物项，更新今日剩余预算 {updated_summary['calorie_remaining']:.0f} kcal",
        "updated_summary": updated_summary,
        "resolved_items": resolved_items,
        "meal_info": meal_info,
        "analysis": analysis,
    }


async def _handle_lookup_food(user_input: str, db: AsyncSession, coach_persona_id: str | None) -> dict[str, Any]:
    coach = get_coach_persona(coach_persona_id)
    keyword = _extract_food_keyword(user_input)
    results = await lookup_food_nutrition(db, keyword)
    if not results:
        message = f"我暂时没在食物库里找到“{keyword}”。你可以换个更常见的名称，或者告诉我品牌/做法再试一次。"
        return {"message": message, "trace_summary": "食物库无匹配结果", "results": []}

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
    message = f"我帮你查到了“{keyword}”的参考营养值：\n" + "\n".join(lines) + f"\n\n{tip}"
    return {"message": message, "trace_summary": f"返回 {min(len(results), 3)} 条食物营养结果", "results": results[:3]}


async def _handle_ask_knowledge(
    user_input: str,
    user_profile: dict,
    daily_summary: dict,
    recent_meals: list[dict],
    recent_exercises: list[dict],
    db: AsyncSession,
) -> dict[str, Any]:
    from app.rag.retriever import retrieve_relevant_chunks

    coach_persona_id = user_profile.get("coach_persona")
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
    return {"message": answer, "trace_summary": f"检索到 {len(chunks)} 个知识片段", "sources": sources}


def _tool_payload(context: dict[str, Any], step: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_input": context["user_input"],
        "user_id": context["user_id"],
        "db": context["db"],
        "user_profile": context["user_profile"],
        "daily_summary": context["daily_summary"],
        "recent_meals": context["recent_meals"],
        "recent_exercises": context["recent_exercises"],
        "coach_persona_id": context["user_profile"].get("coach_persona"),
        "step": step,
    }


def _build_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()

    async def log_meal_tool(payload: dict[str, Any]) -> dict[str, Any]:
        result = await _log_meal_and_collect(
            user_input=payload["user_input"],
            user_id=payload["user_id"],
            user_profile=payload["user_profile"],
            db=payload["db"],
        )
        if result.get("updated_summary"):
            payload["daily_summary"].clear()
            payload["daily_summary"].update(result["updated_summary"])
        return result

    async def lookup_food_tool(payload: dict[str, Any]) -> dict[str, Any]:
        return await _handle_lookup_food(payload["user_input"], payload["db"], payload["coach_persona_id"])

    async def answer_nutrition_tool(payload: dict[str, Any]) -> dict[str, Any]:
        response = await _chat_with_context(
            payload["user_input"],
            payload["coach_persona_id"],
            payload["user_profile"],
            payload["daily_summary"],
            payload["recent_meals"],
            payload["recent_exercises"],
            "你当前的任务是回答与今日热量预算、还剩多少能吃什么、如何保持缺口相关的问题。",
        )
        return {"message": response, "trace_summary": "结合今日预算生成饮食建议"}

    async def answer_knowledge_tool(payload: dict[str, Any]) -> dict[str, Any]:
        return await _handle_ask_knowledge(
            payload["user_input"],
            payload["user_profile"],
            payload["daily_summary"],
            payload["recent_meals"],
            payload["recent_exercises"],
            payload["db"],
        )

    async def recommend_recipe_tool(payload: dict[str, Any]) -> dict[str, Any]:
        response = await recommend_recipe(
            payload["user_profile"],
            payload["daily_summary"],
            payload["user_input"],
            payload["coach_persona_id"],
        )
        return {"message": response, "trace_summary": "基于用户画像和预算生成推荐一餐"}

    async def general_chat_tool(payload: dict[str, Any]) -> dict[str, Any]:
        response = await _chat_with_context(
            payload["user_input"],
            payload["coach_persona_id"],
            payload["user_profile"],
            payload["daily_summary"],
            payload["recent_meals"],
            payload["recent_exercises"],
            "你当前的任务是作为长期陪伴型 AI 私教回答用户，适度引导用户继续记录、执行和复盘。",
        )
        return {"message": response, "trace_summary": "完成单步聊天回复"}

    registry.register(
        ToolDefinition(
            name="log_meal",
            description="解析自然语言餐食并写入餐食记录，同时更新每日热量预算。",
            input_schema={"user_input": "str", "user_id": "int"},
            handler=log_meal_tool,
        )
    )
    registry.register(
        ToolDefinition(
            name="lookup_food",
            description="查询食物库中的营养和热量信息。",
            input_schema={"user_input": "str"},
            handler=lookup_food_tool,
        )
    )
    registry.register(
        ToolDefinition(
            name="answer_nutrition",
            description="结合今日预算、最近餐食和运动给出营养建议。",
            input_schema={"user_input": "str", "daily_summary": "dict"},
            handler=answer_nutrition_tool,
        )
    )
    registry.register(
        ToolDefinition(
            name="answer_knowledge",
            description="通过 RAG 检索营养知识并生成回答。",
            input_schema={"user_input": "str"},
            handler=answer_knowledge_tool,
        )
    )
    registry.register(
        ToolDefinition(
            name="recommend_recipe",
            description="根据用户画像、预算和训练场景推荐一餐。",
            input_schema={"user_input": "str", "daily_summary": "dict"},
            handler=recommend_recipe_tool,
        )
    )
    registry.register(
        ToolDefinition(
            name="general_chat",
            description="作为长期陪伴型 AI 私教回复用户。",
            input_schema={"user_input": "str"},
            handler=general_chat_tool,
        )
    )
    return registry


async def _execute_plan(
    registry: ToolRegistry,
    plan_steps: list[dict[str, Any]],
    context: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    step_results: list[dict[str, Any]] = []
    execution_trace: list[dict[str, Any]] = []

    for step in plan_steps:
        payload = _tool_payload(context, step)
        try:
            result = await registry.invoke(step["tool"], payload)
            step_results.append({"tool": step["tool"], "message": result.get("message", ""), "data": result})
            execution_trace.append(
                {
                    "step_id": step["id"],
                    "tool": step["tool"],
                    "purpose": step["purpose"],
                    "status": "completed",
                    "summary": result.get("trace_summary") or _coerce_trace_summary(result.get("message", "")),
                }
            )
        except Exception as exc:
            execution_trace.append(
                {
                    "step_id": step["id"],
                    "tool": step["tool"],
                    "purpose": step["purpose"],
                    "status": "failed",
                    "summary": f"{type(exc).__name__}: {str(exc)[:160]}",
                }
            )
            raise

    return step_results, execution_trace


def _compose_final_response(mode: str, step_results: list[dict[str, Any]]) -> str:
    if not step_results:
        return "这次执行没有拿到可展示的结果。"

    if mode == "direct":
        return step_results[-1]["message"]

    title_map = {
        "log_meal": "记录结果",
        "answer_nutrition": "预算分析",
        "recommend_recipe": "下一步建议",
        "lookup_food": "查询结果",
        "answer_knowledge": "知识回答",
        "general_chat": "回复",
    }
    sections = []
    for item in step_results:
        message = item.get("message")
        if not message:
            continue
        title = title_map.get(item["tool"], item["tool"])
        sections.append(f"{title}：\n{message}")
    return "\n\n".join(sections) if sections else "这次执行完成了，但没有拿到可展示的文本结果。"


async def run_agent(
    user_input: str,
    user_id: int,
    db: AsyncSession,
    conversation_id: str | None = None,
) -> dict:
    session_key = get_session_key(user_id, conversation_id)
    merged_input, resumed_from_clarification = merge_pending_input(session_key, user_input)

    intent = await classify_intent(merged_input)
    user_profile, daily_summary, recent_meals, recent_exercises = await _load_user_context(db, user_id)
    plan_info = build_execution_plan(merged_input, intent)
    plan_steps = plan_info["steps"]
    clarification = detect_clarification_need(merged_input, plan_steps, recent_exercises)

    if clarification.requires_clarification:
        save_pending_clarification(session_key, merged_input, clarification.question or "", clarification.missing_fields or [])
        return {
            "response": clarification.question,
            "intent": intent,
            "mode": "clarification",
            "plan": plan_steps,
            "execution_trace": [],
            "context_snapshot": _build_context_snapshot(user_profile, daily_summary, recent_meals, recent_exercises),
            "requires_clarification": True,
            "clarification_question": clarification.question,
            "missing_fields": clarification.missing_fields or [],
            "tool_catalog": _build_tool_registry().list_tools(),
            "resumed_from_clarification": resumed_from_clarification,
        }

    registry = _build_tool_registry()
    context = {
        "user_input": merged_input,
        "user_id": user_id,
        "db": db,
        "user_profile": user_profile,
        "daily_summary": daily_summary,
        "recent_meals": recent_meals,
        "recent_exercises": recent_exercises,
    }
    step_results, execution_trace = await _execute_plan(registry, plan_steps, context)
    final_response = _compose_final_response(str(plan_info["mode"]), step_results)

    return {
        "response": final_response,
        "intent": intent,
        "mode": plan_info["mode"],
        "plan": plan_steps,
        "execution_trace": execution_trace,
        "context_snapshot": _build_context_snapshot(user_profile, context["daily_summary"], recent_meals, recent_exercises),
        "requires_clarification": False,
        "clarification_question": None,
        "missing_fields": [],
        "tool_catalog": registry.list_tools(),
        "resumed_from_clarification": resumed_from_clarification,
    }
