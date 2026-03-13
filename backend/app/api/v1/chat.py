from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.agents.graph import run_agent

router = APIRouter(prefix="/chat", tags=["AI对话"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    intent: str | None = None


@router.post("/", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI 对话端点 — 统一入口，根据意图路由到不同 Agent"""
    try:
        response = await run_agent(
            user_input=data.message,
            user_id=user.id,
            db=db,
        )
        return ChatResponse(response=response)
    except Exception as e:
        error_msg = str(e)
        import traceback
        print("CHAT ERROR:", repr(error_msg))
        print(traceback.format_exc())
        if "api_key" in error_msg.lower() or "authentication" in error_msg.lower() or "unauthorized" in error_msg.lower():
            return ChatResponse(
                response=f"⚠️ 认证错误（DEBUG）：{error_msg[:300]}"
            )
        return ChatResponse(
            response=f"⚠️ AI 服务暂时不可用，请稍后重试。错误信息：{error_msg[:200]}"
        )
