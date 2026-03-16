"""Router agent with LLM classification and rule-based fallback."""
try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover - optional in offline test env
    AsyncOpenAI = None

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL) if AsyncOpenAI else None

ROUTER_SYSTEM_PROMPT = """你是一个营养教练助手的意图分类器。根据用户输入，只输出一个意图标签，不要输出其他内容。

可选意图：
- log_meal: 用户想记录自己刚吃了什么
- lookup_food: 用户想查某个食物或饮品的热量/营养
- query_nutrition: 用户想看自己今天还能吃什么、今天摄入多少、热量缺口如何
- ask_knowledge: 用户在问饮食原则、减脂知识、训练后饮食等泛知识问题
- recommend_recipe: 用户想要一餐或一个场景下的饮食推荐
- general_chat: 其他普通闲聊或无法明确分类的内容
"""


def classify_intent_with_rules(user_input: str) -> str:
    text = user_input.lower()
    meal_record_signals = ("记录", "吃了", "喝了", "刚吃", "刚喝", "记一顿", "记个")
    meal_type_signals = ("早餐", "午餐", "晚餐", "加餐")

    if any(keyword in text for keyword in ("查", "热量", "卡路里", "营养", "成分")):
        return "lookup_food"

    if any(keyword in text for keyword in meal_record_signals):
        return "log_meal"

    if any(keyword in text for keyword in ("训练后", "原理", "为什么", "减脂", "增肌", "营养知识")):
        return "ask_knowledge"

    if any(keyword in text for keyword in ("推荐", "食谱", "下一餐", "怎么吃")):
        return "recommend_recipe"

    if any(keyword in text for keyword in ("还能吃什么", "剩余", "预算", "缺口", "摄入多少")):
        return "query_nutrition"

    if any(keyword in text for keyword in meal_type_signals):
        return "log_meal"

    return "general_chat"


async def classify_intent(user_input: str) -> str:
    if not settings.DEEPSEEK_API_KEY or client is None:
        return classify_intent_with_rules(user_input)

    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
            ],
            temperature=0,
            max_tokens=20,
        )
        intent = response.choices[0].message.content.strip().lower()
    except Exception:
        return classify_intent_with_rules(user_input)

    valid_intents = {
        "log_meal",
        "lookup_food",
        "query_nutrition",
        "ask_knowledge",
        "recommend_recipe",
        "general_chat",
    }
    if intent not in valid_intents:
        for valid in valid_intents:
            if valid in intent:
                return valid
        return classify_intent_with_rules(user_input)
    return intent


async def router_node(state: dict) -> dict:
    user_input = state.get("user_input", "")
    intent = await classify_intent(user_input)
    return {"intent": intent}
