"""Main LangGraph workflow for NutriAgent."""
import json
from datetime import date

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState
from app.agents.router_agent import classify_intent
from app.agents.food_parser import parse_meal_text, resolve_foods
from app.agents.sql_agent import get_daily_intake, get_recent_meals
from app.agents.nutrition_agent import analyze_nutrition
from app.agents.recipe_agent import recommend_recipe
from app.config import settings
from app.models.user import UserProfile
from app.services.meal_service import create_meal

from openai import AsyncOpenAI
from sqlalchemy import select

llm_client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)


async def _load_user_context(db: AsyncSession, user_id: int) -> tuple[dict, dict]:
    """Load user profile and daily summary."""
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    user_profile = {}
    if profile:
        user_profile = {
            "goal_type": profile.goal_type,
            "daily_calorie_target": profile.daily_calorie_target,
            "current_weight_kg": float(profile.current_weight_kg) if profile.current_weight_kg else None,
            "target_weight_kg": float(profile.target_weight_kg) if profile.target_weight_kg else None,
            "activity_level": profile.activity_level,
            "taste_preference": profile.taste_preference,
            "allergies": profile.allergies,
            "dietary_restrictions": profile.dietary_restrictions,
        }

    daily_summary = await get_daily_intake(db, user_id)
    return user_profile, daily_summary


async def run_agent(user_input: str, user_id: int, db: AsyncSession) -> str:
    """Run the agent workflow and return the response.

    This is a simplified sequential execution instead of a full LangGraph compile,
    because we need to pass the db session through the workflow.
    """
    # Step 1: Classify intent
    intent = await classify_intent(user_input)

    # Step 2: Load user context
    user_profile, daily_summary = await _load_user_context(db, user_id)

    # Step 3: Execute based on intent
    if intent == "log_meal":
        return await _handle_log_meal(user_input, user_id, user_profile, daily_summary, db)
    elif intent == "query_nutrition":
        return await _handle_query_nutrition(user_input, user_id, user_profile, daily_summary, db)
    elif intent == "ask_knowledge":
        return await _handle_ask_knowledge(user_input, user_profile, daily_summary, db)
    elif intent == "recommend_recipe":
        return await _handle_recommend_recipe(user_input, user_profile, daily_summary)
    else:
        return await _handle_general_chat(user_input)


async def _handle_log_meal(
    user_input: str, user_id: int, user_profile: dict, daily_summary: dict, db: AsyncSession
) -> str:
    """Handle meal logging intent."""
    # Parse food items
    parsed_items = await parse_meal_text(user_input)
    if not parsed_items:
        return "抱歉，我没有识别出具体的食物。你能再详细描述一下你吃了什么吗？"

    # Resolve against database
    resolved_items = await resolve_foods(parsed_items, db)

    # Create meal record for items with food_id
    valid_items = [item for item in resolved_items if item.get("food_id")]
    if valid_items:
        meal_items = [{"food_id": item["food_id"], "amount_g": item["amount_g"]} for item in valid_items]
        await create_meal(
            db=db,
            user_id=user_id,
            meal_type="lunch",  # TODO: detect meal type from time/context
            meal_date=date.today(),
            items=meal_items,
            input_mode="text",
            raw_input=user_input,
        )

    # Build summary
    total_cal = sum(item.get("calories_kcal", 0) or 0 for item in resolved_items)
    total_protein = sum(item.get("protein_g", 0) or 0 for item in resolved_items)
    total_fat = sum(item.get("fat_g", 0) or 0 for item in resolved_items)
    total_carb = sum(item.get("carb_g", 0) or 0 for item in resolved_items)

    meal_info = "\n".join(
        f"- {item['food_name']} {item['amount_g']}g: {item.get('calories_kcal', '未知')} kcal"
        for item in resolved_items
    )

    # Get updated daily summary
    updated_summary = await get_daily_intake(db, user_id)

    # Generate nutrition analysis
    analysis = await analyze_nutrition(
        meal_info=f"刚记录的一餐：\n{meal_info}\n本餐合计：{total_cal:.0f} kcal",
        user_profile=user_profile,
        daily_summary=updated_summary,
    )

    response = f"✅ 已记录饮食：\n{meal_info}\n\n"
    response += f"📊 本餐合计：{total_cal:.0f} kcal | 蛋白质 {total_protein:.1f}g | 脂肪 {total_fat:.1f}g | 碳水 {total_carb:.1f}g\n\n"
    response += f"📈 今日累计：{updated_summary['total_calories_kcal']:.0f} / {updated_summary['calorie_target']} kcal（剩余 {updated_summary['calorie_remaining']:.0f} kcal）\n\n"
    response += f"💡 营养分析：\n{analysis}"

    return response


async def _handle_query_nutrition(
    user_input: str, user_id: int, user_profile: dict, daily_summary: dict, db: AsyncSession
) -> str:
    """Handle nutrition query intent."""
    recent_meals = await get_recent_meals(db, user_id, days=1)

    meals_str = ""
    for meal in recent_meals:
        items_str = ", ".join(f"{i['name']}({i['calories_kcal']}kcal)" for i in meal["items"])
        meals_str += f"- {meal['meal_type']}: {items_str} (共{meal['total_calories_kcal']}kcal)\n"

    response = f"📊 今日饮食汇总（{daily_summary['date']}）：\n\n"
    response += f"🔥 已摄入热量：{daily_summary['total_calories_kcal']:.0f} kcal\n"
    response += f"🎯 每日目标：{daily_summary['calorie_target']} kcal\n"
    response += f"📉 剩余可摄入：{daily_summary['calorie_remaining']:.0f} kcal\n\n"
    response += f"🥩 蛋白质：{daily_summary['total_protein_g']:.1f}g\n"
    response += f"🧈 脂肪：{daily_summary['total_fat_g']:.1f}g\n"
    response += f"🍚 碳水：{daily_summary['total_carb_g']:.1f}g\n"

    if meals_str:
        response += f"\n📋 今日餐食记录：\n{meals_str}"

    return response


async def _handle_ask_knowledge(
    user_input: str, user_profile: dict, daily_summary: dict, db: AsyncSession
) -> str:
    """Handle nutrition knowledge questions using RAG."""
    from app.rag.retriever import retrieve_relevant_chunks

    # Retrieve relevant knowledge chunks
    chunks = await retrieve_relevant_chunks(db, user_input, top_k=5)

    # Build context from retrieved chunks
    rag_context = ""
    sources = set()
    if chunks:
        for chunk in chunks:
            rag_context += f"\n---\n{chunk['text']}\n"
            sources.add(chunk["source"])

    user_context = f"""用户目标：{user_profile.get('goal_type', '未设置')}
今日已摄入：{daily_summary.get('total_calories_kcal', 0)} kcal"""

    system_prompt = f"""你是一位专业的AI营养师，擅长解答营养和饮食相关问题。

以下是从营养知识库中检索到的相关内容，请优先基于这些内容回答用户问题：
{rag_context}

用户背景：{user_context}

回答要求：
1. 基于检索到的知识回答，确保准确性
2. 语言简洁实用
3. 如果检索内容与问题不相关，可以基于你的专业知识回答
4. 回答末尾标注参考来源"""

    response = await llm_client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        temperature=0.7,
        max_tokens=600,
    )
    answer = response.choices[0].message.content.strip()

    if sources:
        answer += f"\n\n📚 参考来源：{', '.join(sources)}"

    return answer


async def _handle_recommend_recipe(
    user_input: str, user_profile: dict, daily_summary: dict
) -> str:
    """Handle recipe recommendation intent."""
    return await recommend_recipe(user_profile, daily_summary, user_input)


async def _handle_general_chat(user_input: str) -> str:
    """Handle general chat."""
    response = await llm_client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "你是NutriAgent，一个AI营养管理助手。你可以帮助用户记录饮食、分析营养、推荐食谱。请友好地介绍自己的功能并引导用户使用。"},
            {"role": "user", "content": user_input},
        ],
        temperature=0.8,
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()
