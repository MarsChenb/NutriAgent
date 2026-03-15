from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import run_agent
from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/chat", tags=["AI 对话"])


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    intent: str | None = None
    context_snapshot: dict[str, Any] | None = None


@router.post("/", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await run_agent(
            user_input=data.message,
            user_id=user.id,
            db=db,
        )
        return ChatResponse(**result)
    except Exception as exc:
        error_msg = str(exc)
        if "api_key" in error_msg.lower() or "authentication" in error_msg.lower() or "unauthorized" in error_msg.lower():
            return ChatResponse(response=f"AI 服务认证失败：{error_msg[:220]}")
        return ChatResponse(response=f"AI 私教暂时不可用，请稍后再试。错误信息：{error_msg[:200]}")
