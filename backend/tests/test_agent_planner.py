import unittest

from app.agents.clarifier import (
    detect_clarification_need,
    get_session_key,
    merge_pending_input,
    save_pending_clarification,
)
from app.agents.planner import build_execution_plan


class PlannerTests(unittest.TestCase):
    def test_build_execution_plan_for_complex_task(self):
        plan = build_execution_plan("我晚餐吃了鸡胸肉和米饭，然后帮我看看今天还能吃什么并推荐晚餐", "log_meal")

        self.assertEqual(plan["mode"], "planned")
        tools = [step["tool"] for step in plan["steps"]]
        self.assertIn("log_meal", tools)
        self.assertIn("answer_nutrition", tools)
        self.assertIn("recommend_recipe", tools)

    def test_build_execution_plan_for_direct_lookup(self):
        plan = build_execution_plan("帮我查香蕉的热量", "lookup_food")

        self.assertEqual(plan["mode"], "direct")
        self.assertEqual(plan["steps"][0]["tool"], "lookup_food")


class ClarifierTests(unittest.TestCase):
    def test_detect_clarification_for_meal_logging(self):
        plan = build_execution_plan("我吃了鸡胸肉和米饭，然后帮我看看今天还能吃什么", "log_meal")

        clarification = detect_clarification_need("我吃了鸡胸肉和米饭，然后帮我看看今天还能吃什么", plan["steps"], [])

        self.assertTrue(clarification.requires_clarification)
        self.assertIn("meal_type", clarification.missing_fields)
        self.assertIn("amount", clarification.missing_fields)

    def test_detect_clarification_for_missing_exercise_context(self):
        plan = build_execution_plan("结合我今天运动推荐一顿晚餐", "recommend_recipe")

        clarification = detect_clarification_need("结合我今天运动推荐一顿晚餐", plan["steps"], [])

        self.assertTrue(clarification.requires_clarification)
        self.assertEqual(clarification.missing_fields, ["exercise_context"])

    def test_pending_clarification_merge(self):
        session_key = get_session_key(user_id=1, conversation_id="thread-1")
        save_pending_clarification(session_key, "我吃了鸡胸肉，帮我看看还能吃什么", "请补充分量", ["amount"])

        merged, resumed = merge_pending_input(session_key, "大概 180 克，算晚餐")

        self.assertTrue(resumed)
        self.assertIn("用户补充信息", merged)
        self.assertIn("180", merged)


if __name__ == "__main__":
    unittest.main()
