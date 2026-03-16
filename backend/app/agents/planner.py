"""Planning utilities for the agent workflow."""
from __future__ import annotations

from dataclasses import asdict, dataclass


COMPLEX_CONNECTORS = ("并", "然后", "再", "同时", "结合", "顺便", "接下来", "并且")
MEAL_RECORD_KEYWORDS = ("吃了", "喝了", "记录", "记一下", "刚吃", "这餐", "帮我记", "记成")
BUDGET_KEYWORDS = ("还能吃", "剩余", "热量缺口", "预算", "今天还能", "还可以吃")
RECIPE_KEYWORDS = ("推荐", "晚餐", "下一餐", "食谱", "怎么吃", "吃什么")
EXERCISE_KEYWORDS = ("运动", "训练", "跑步", "健身", "力量", "有氧", "骑车", "游泳")


@dataclass(slots=True)
class PlanStep:
    id: str
    tool: str
    purpose: str
    status: str = "pending"


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _needs_complex_execution(user_input: str, intent: str) -> bool:
    if _contains_any(user_input, COMPLEX_CONNECTORS):
        return True

    has_meal_signal = intent == "log_meal" or _contains_any(user_input, MEAL_RECORD_KEYWORDS)
    has_budget_signal = _contains_any(user_input, BUDGET_KEYWORDS)
    has_recipe_signal = _contains_any(user_input, RECIPE_KEYWORDS)
    has_exercise_signal = _contains_any(user_input, EXERCISE_KEYWORDS)

    if has_meal_signal and (has_budget_signal or has_recipe_signal):
        return True
    if intent == "recommend_recipe" and (has_exercise_signal or has_budget_signal):
        return True
    if intent == "query_nutrition" and has_meal_signal:
        return True
    return False


def _direct_tool_for_intent(intent: str) -> tuple[str, str]:
    mapping = {
        "log_meal": ("log_meal", "解析并记录用户刚刚输入的餐食"),
        "lookup_food": ("lookup_food", "查询食物热量和营养值"),
        "query_nutrition": ("answer_nutrition", "结合今日预算回答还能怎么吃"),
        "ask_knowledge": ("answer_knowledge", "回答营养和减脂知识问题"),
        "recommend_recipe": ("recommend_recipe", "根据当前情况推荐一餐"),
        "general_chat": ("general_chat", "作为长期陪伴型 AI 私教回复用户"),
    }
    return mapping.get(intent, ("general_chat", "回复用户"))


def build_execution_plan(user_input: str, intent: str) -> dict[str, object]:
    if not _needs_complex_execution(user_input, intent):
        tool, purpose = _direct_tool_for_intent(intent)
        steps = [PlanStep(id="step_1", tool=tool, purpose=purpose)]
        return {
            "mode": "direct",
            "reasoning": "请求可以由单一能力直接完成，不需要额外拆解。",
            "steps": [asdict(step) for step in steps],
        }

    steps: list[PlanStep] = []
    normalized = user_input.strip()
    has_meal_signal = intent == "log_meal" or _contains_any(normalized, MEAL_RECORD_KEYWORDS)
    has_budget_signal = _contains_any(normalized, BUDGET_KEYWORDS)
    has_recipe_signal = _contains_any(normalized, RECIPE_KEYWORDS)
    has_exercise_signal = _contains_any(normalized, EXERCISE_KEYWORDS)

    if has_meal_signal:
        steps.append(PlanStep(id=f"step_{len(steps) + 1}", tool="log_meal", purpose="先把用户刚提到的饮食记录下来"))

    if has_budget_signal or intent == "query_nutrition":
        steps.append(PlanStep(id=f"step_{len(steps) + 1}", tool="answer_nutrition", purpose="根据更新后的预算给出剩余热量建议"))

    if has_recipe_signal or intent == "recommend_recipe":
        recipe_purpose = "结合用户目标和剩余预算推荐下一餐"
        if has_exercise_signal:
            recipe_purpose = "结合训练场景、当前预算和目标推荐一餐"
        steps.append(PlanStep(id=f"step_{len(steps) + 1}", tool="recommend_recipe", purpose=recipe_purpose))

    if not steps:
        tool, purpose = _direct_tool_for_intent(intent)
        steps.append(PlanStep(id="step_1", tool=tool, purpose=purpose))
        mode = "direct"
        reasoning = "没有检测到稳定的复合任务信号，退回单步执行。"
    else:
        mode = "planned"
        reasoning = "用户请求同时涉及记录、预算判断或推荐等多个动作，适合拆成多步执行。"

    return {
        "mode": mode,
        "reasoning": reasoning,
        "steps": [asdict(step) for step in steps],
    }
