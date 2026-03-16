"""Memory helpers for short-term and long-term agent context."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover
    from sqlalchemy.ext.asyncio import AsyncSession

PROFILE_MEMORY_TYPES = {"goal", "preference", "restriction", "health", "habit"}


def build_profile_memories(user_profile: dict[str, Any]) -> list[dict[str, Any]]:
    memories: list[dict[str, Any]] = []

    goal_type = user_profile.get("goal_type")
    if goal_type:
        memories.append(
            {
                "memory_type": "goal",
                "memory_text": f"当前目标是 {goal_type}",
                "importance_score": 0.95,
            }
        )

    activity_level = user_profile.get("activity_level")
    if activity_level:
        memories.append(
            {
                "memory_type": "habit",
                "memory_text": f"日常活动水平是 {activity_level}",
                "importance_score": 0.72,
            }
        )

    for field, label in (
        ("taste_preference", "口味偏好"),
        ("allergies", "过敏信息"),
        ("dietary_restrictions", "饮食限制"),
        ("medical_history", "健康史"),
    ):
        value = user_profile.get(field)
        if not value:
            continue
        memory_type = "preference"
        importance = 0.68
        if field in {"allergies", "dietary_restrictions"}:
            memory_type = "restriction"
            importance = 0.92
        elif field == "medical_history":
            memory_type = "health"
            importance = 0.88

        memories.append(
            {
                "memory_type": memory_type,
                "memory_text": f"{label}: {value}",
                "importance_score": importance,
            }
        )

    return memories


async def sync_profile_memories(db: "AsyncSession", user_id: int, user_profile: dict[str, Any]) -> list[dict[str, Any]]:
    from sqlalchemy import delete

    from app.models.memory import LongTermMemory

    memories = build_profile_memories(user_profile)
    await db.execute(
        delete(LongTermMemory).where(
            LongTermMemory.user_id == user_id,
            LongTermMemory.memory_type.in_(PROFILE_MEMORY_TYPES),
        )
    )

    for item in memories:
        db.add(
            LongTermMemory(
                user_id=user_id,
                memory_type=item["memory_type"],
                memory_text=item["memory_text"],
                importance_score=item["importance_score"],
            )
        )

    await db.flush()
    return memories


async def fetch_long_term_memories(db: "AsyncSession", user_id: int, limit: int = 6) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.memory import LongTermMemory

    result = await db.execute(
        select(LongTermMemory)
        .where(LongTermMemory.user_id == user_id)
        .order_by(LongTermMemory.importance_score.desc().nullslast(), LongTermMemory.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "memory_type": row.memory_type,
            "memory_text": row.memory_text,
            "importance_score": float(row.importance_score) if row.importance_score is not None else None,
        }
        for row in rows
    ]


async def append_conversation_message(
    db: "AsyncSession",
    user_id: int,
    role: str,
    message_text: str,
    conversation_id: str | None = None,
) -> None:
    from app.models.memory import ConversationHistory

    db.add(
        ConversationHistory(
            user_id=user_id,
            conversation_id=conversation_id,
            role=role,
            message_text=message_text,
        )
    )
    await db.flush()


async def fetch_recent_conversation(
    db: "AsyncSession",
    user_id: int,
    conversation_id: str | None = None,
    limit: int = 6,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.memory import ConversationHistory

    stmt = select(ConversationHistory).where(ConversationHistory.user_id == user_id)
    if conversation_id:
        stmt = stmt.where(ConversationHistory.conversation_id == conversation_id)

    result = await db.execute(
        stmt.order_by(ConversationHistory.created_at.desc(), ConversationHistory.id.desc()).limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    return [{"role": row.role, "message_text": row.message_text} for row in rows]


def format_memory_context(memories: list[dict[str, Any]]) -> str:
    if not memories:
        return "暂无长期记忆。"
    return "\n".join(f"- [{item['memory_type']}] {item['memory_text']}" for item in memories)


def format_conversation_context(messages: list[dict[str, Any]]) -> str:
    if not messages:
        return "暂无最近会话。"
    return "\n".join(f"- {item['role']}: {item['message_text']}" for item in messages)
