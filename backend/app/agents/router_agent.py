"""Router Agent: classifies user intent."""
from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)

ROUTER_SYSTEM_PROMPT = """你是一个营养教练助手的意图分类器。根据用户输入，只输出一个意图标签，不要输出其他内容。

可选意图：
- log_meal: 用户想记录自己刚吃了什么
- lookup_food: 用户想查某个食物或饮品的热量/营养
- query_nutrition: 用户想看自己今天还能吃什么、今天摄入多少、热量缺口如何
- ask_knowledge: 用户在问饮食原则、减脂知识、训练后饮食等泛知识问题
- recommend_recipe: 用户想要一餐或一个场景下的饮食推荐
- general_chat: 其他普通闲聊或无法明确分类的内容

示例：
用户: 我中午吃了鸡胸肉和米饭 -> log_meal
用户: 帮我查香蕉的热量 -> lookup_food
用户: 今天还能吃什么 -> query_nutrition
用户: 训练后怎么吃更合适 -> ask_knowledge
用户: 推荐一顿减脂晚餐 -> recommend_recipe
用户: 你好 -> general_chat
"""


async def classify_intent(user_input: str) -> str:
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
        return "general_chat"
    return intent


async def router_node(state: dict) -> dict:
    user_input = state.get("user_input", "")
    intent = await classify_intent(user_input)
    return {"intent": intent}
