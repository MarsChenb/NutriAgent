"""Offline-friendly evaluation helpers for agent routing and planning."""
from __future__ import annotations

from dataclasses import asdict, dataclass

from app.agents.clarifier import detect_clarification_need
from app.agents.planner import build_execution_plan
from app.agents.router_agent import classify_intent_with_rules


@dataclass(slots=True)
class AgentEvalCase:
    name: str
    user_input: str
    expected_intent: str
    expected_mode: str
    expected_tools: list[str]
    expect_clarification: bool
    recent_exercises: list[dict] | None = None


def default_eval_cases() -> list[AgentEvalCase]:
    return [
        AgentEvalCase(
            name="food_lookup",
            user_input="帮我查一下香蕉的热量和三大营养素",
            expected_intent="lookup_food",
            expected_mode="direct",
            expected_tools=["lookup_food"],
            expect_clarification=False,
        ),
        AgentEvalCase(
            name="meal_and_budget",
            user_input="我晚餐吃了鸡胸肉和米饭，然后帮我看看今天还能吃什么",
            expected_intent="log_meal",
            expected_mode="planned",
            expected_tools=["log_meal", "answer_nutrition"],
            expect_clarification=True,
        ),
        AgentEvalCase(
            name="post_workout_meal",
            user_input="结合我今天运动推荐一顿晚餐",
            expected_intent="recommend_recipe",
            expected_mode="planned",
            expected_tools=["recommend_recipe"],
            expect_clarification=True,
        ),
        AgentEvalCase(
            name="knowledge_question",
            user_input="减脂期为什么要优先保证蛋白质",
            expected_intent="ask_knowledge",
            expected_mode="direct",
            expected_tools=["answer_knowledge"],
            expect_clarification=False,
        ),
        AgentEvalCase(
            name="general_chat",
            user_input="最近状态有点乱，想重新找回节奏",
            expected_intent="general_chat",
            expected_mode="direct",
            expected_tools=["general_chat"],
            expect_clarification=False,
        ),
    ]


def evaluate_agent_components(cases: list[AgentEvalCase] | None = None) -> dict[str, object]:
    cases = cases or default_eval_cases()
    details: list[dict[str, object]] = []
    intent_hits = 0
    mode_hits = 0
    tool_hits = 0
    clarification_hits = 0

    for case in cases:
        predicted_intent = classify_intent_with_rules(case.user_input)
        plan = build_execution_plan(case.user_input, predicted_intent)
        tools = [step["tool"] for step in plan["steps"]]
        clarification = detect_clarification_need(case.user_input, plan["steps"], case.recent_exercises or [])

        intent_ok = predicted_intent == case.expected_intent
        mode_ok = plan["mode"] == case.expected_mode
        tools_ok = tools == case.expected_tools
        clarification_ok = clarification.requires_clarification == case.expect_clarification

        intent_hits += int(intent_ok)
        mode_hits += int(mode_ok)
        tool_hits += int(tools_ok)
        clarification_hits += int(clarification_ok)

        details.append(
            {
                "case": case.name,
                "predicted_intent": predicted_intent,
                "expected_intent": case.expected_intent,
                "mode": plan["mode"],
                "expected_mode": case.expected_mode,
                "tools": tools,
                "expected_tools": case.expected_tools,
                "requires_clarification": clarification.requires_clarification,
                "expected_clarification": case.expect_clarification,
                "passed": intent_ok and mode_ok and tools_ok and clarification_ok,
            }
        )

    total = max(len(cases), 1)
    return {
        "cases": total,
        "intent_accuracy": round(intent_hits / total, 3),
        "plan_mode_accuracy": round(mode_hits / total, 3),
        "tool_selection_accuracy": round(tool_hits / total, 3),
        "clarification_accuracy": round(clarification_hits / total, 3),
        "details": details,
    }


def format_evaluation_report(results: dict[str, object]) -> str:
    detail_lines = []
    for item in results["details"]:
        detail_lines.append(
            f"- {item['case']}: intent={item['predicted_intent']} mode={item['mode']} tools={','.join(item['tools'])} pass={item['passed']}"
        )

    header = (
        f"cases={results['cases']} | "
        f"intent_accuracy={results['intent_accuracy']} | "
        f"plan_mode_accuracy={results['plan_mode_accuracy']} | "
        f"tool_selection_accuracy={results['tool_selection_accuracy']} | "
        f"clarification_accuracy={results['clarification_accuracy']}"
    )
    return header + "\n" + "\n".join(detail_lines)


def serialize_eval_cases() -> list[dict[str, object]]:
    return [asdict(case) for case in default_eval_cases()]
