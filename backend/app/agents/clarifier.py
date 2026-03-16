"""Clarification helpers for human-in-the-loop flows."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


AMOUNT_HINTS = ("克", "g", "G", "片", "个", "碗", "杯", "勺", "份", "块", "ml", "ML")
MEAL_TYPE_HINTS = {
    "早餐": "breakfast",
    "早饭": "breakfast",
    "午餐": "lunch",
    "中午": "lunch",
    "晚餐": "dinner",
    "晚上": "dinner",
    "加餐": "snack",
}
EXERCISE_HINTS = ("跑步", "训练", "健身", "力量", "有氧", "游泳", "骑车", "跳绳")


@dataclass(slots=True)
class ClarificationResult:
    requires_clarification: bool
    question: str | None = None
    missing_fields: list[str] | None = None


_PENDING_CLARIFICATIONS: dict[str, dict[str, Any]] = {}


def get_session_key(user_id: int, conversation_id: str | None = None) -> str:
    return conversation_id or f"user:{user_id}"


def merge_pending_input(session_key: str, user_input: str) -> tuple[str, bool]:
    pending = _PENDING_CLARIFICATIONS.pop(session_key, None)
    if not pending:
        return user_input, False
    merged = f"{pending['original_user_input']}\n用户补充信息：{user_input}"
    return merged, True


def save_pending_clarification(
    session_key: str,
    original_user_input: str,
    question: str,
    missing_fields: list[str],
) -> None:
    _PENDING_CLARIFICATIONS[session_key] = {
        "original_user_input": original_user_input,
        "question": question,
        "missing_fields": missing_fields,
    }


def detect_clarification_need(
    user_input: str,
    plan_steps: list[dict[str, Any]],
    recent_exercises: list[dict[str, Any]],
) -> ClarificationResult:
    tools = {step["tool"] for step in plan_steps}
    missing_fields: list[str] = []

    if "log_meal" in tools:
        if not any(meal_type in user_input for meal_type in MEAL_TYPE_HINTS):
            missing_fields.append("meal_type")
        if not any(hint in user_input for hint in AMOUNT_HINTS) and not any(char.isdigit() for char in user_input):
            missing_fields.append("amount")

    if "recommend_recipe" in tools and "结合" in user_input and "运动" in user_input:
        has_inline_exercise = any(hint in user_input for hint in EXERCISE_HINTS)
        if not recent_exercises and not has_inline_exercise:
            missing_fields.append("exercise_context")

    if not missing_fields:
        return ClarificationResult(requires_clarification=False, missing_fields=[])

    if missing_fields == ["meal_type", "amount"]:
        question = "为了帮你准确记录，这餐是早餐、午餐、晚餐还是加餐？大概吃了多少，比如几片、几碗或多少克？"
    elif missing_fields == ["meal_type"]:
        question = "这餐是早餐、午餐、晚餐还是加餐？告诉我餐次后我再继续。"
    elif missing_fields == ["amount"]:
        question = "为了记录得更准，补充一下大概分量吧，比如几片、几碗、多少克。"
    elif missing_fields == ["exercise_context"]:
        question = "如果要结合运动给你推荐，先告诉我你今天做了什么运动、持续多久，或者先记录一条运动数据。"
    else:
        question = "我还缺一点关键信息。你可以把餐次、分量或运动情况再补充一下，我再继续执行。"

    return ClarificationResult(
        requires_clarification=True,
        question=question,
        missing_fields=missing_fields,
    )
