"""Vision-based food recognition using multimodal LLM."""
import base64
import json

from openai import AsyncOpenAI

from app.config import settings

client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)

VISION_SYSTEM_PROMPT = """你是一个食物识别助手。分析用户上传的餐食照片，识别出图中的每种食物及其估计重量。

输出严格的JSON数组格式，不要输出其他内容：
[{"food_name": "食物名称", "amount_g": 估计重量克数, "confidence": 置信度0-1}]

注意：
- 尽量识别所有可见的食物
- 估计合理的份量
- 如果不确定，给出你最好的估计并降低置信度"""


async def recognize_food_from_image(image_bytes: bytes) -> list[dict]:
    """Recognize foods from an image using vision LLM."""
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",  # Switch to vision model when available
            messages=[
                {"role": "system", "content": VISION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请识别这张餐食照片中的食物："},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                        },
                    ],
                },
            ],
            temperature=0,
            max_tokens=500,
        )
        content = response.choices[0].message.content.strip()

        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        return json.loads(content)
    except Exception as e:
        # If vision model is not available, return error
        return [{"error": f"图片识别暂不可用: {str(e)}"}]
