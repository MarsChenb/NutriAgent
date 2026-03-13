"""Router Agent: classifies user intent."""
from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)

ROUTER_SYSTEM_PROMPT = """你是一个意图分类器。根据用户输入，判断属于以下哪种意图，只输出意图标签，不要输出其他内容。

意图类别：
- log_meal: 用户想记录/登记一顿饭（例如"我中午吃了..."、"帮我记录早餐"、"午饭吃了黄焖鸡"）
- query_nutrition: 用户想查询自己的饮食数据/热量/统计（例如"今天吃了多少热量"、"这周蛋白质摄入"）
- ask_knowledge: 用户问营养知识/饮食原则/健康问题（例如"减脂晚上吃什么好"、"低GI是什么意思"）
- recommend_recipe: 用户想要食谱推荐/下一顿建议（例如"推荐晚餐"、"给我推荐一顿500卡的饭"）
- general_chat: 其他闲聊或无法分类的内容

示例：
用户: "我中午吃了两碗米饭和一个鸡腿" → log_meal
用户: "今天还能吃多少热量" → query_nutrition
用户: "减脂期间主食应该怎么选" → ask_knowledge
用户: "推荐一顿晚餐" → recommend_recipe
用户: "你好" → general_chat
"""


async def classify_intent(user_input: str) -> str:
    """Classify user intent using DeepSeek."""
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

    valid_intents = {"log_meal", "query_nutrition", "ask_knowledge", "recommend_recipe", "general_chat"}
    if intent not in valid_intents:
        # Try to extract from response
        for valid in valid_intents:
            if valid in intent:
                return valid
        return "general_chat"
    return intent


async def router_node(state: dict) -> dict:
    """Router agent node for LangGraph."""
    user_input = state.get("user_input", "")
    intent = await classify_intent(user_input)
    return {"intent": intent}
