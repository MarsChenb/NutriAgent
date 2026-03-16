import unittest

from app.agents.evaluation import evaluate_agent_components, format_evaluation_report


class AgentEvaluationTests(unittest.TestCase):
    def test_evaluation_metrics_cover_default_cases(self):
        results = evaluate_agent_components()

        self.assertEqual(results["cases"], 5)
        self.assertGreaterEqual(results["intent_accuracy"], 0.8)
        self.assertGreaterEqual(results["plan_mode_accuracy"], 0.8)
        self.assertGreaterEqual(results["tool_selection_accuracy"], 0.8)
        self.assertGreaterEqual(results["clarification_accuracy"], 0.8)

    def test_report_output_is_readable(self):
        report = format_evaluation_report(evaluate_agent_components())

        self.assertIn("intent_accuracy", report)
        self.assertIn("food_lookup", report)


if __name__ == "__main__":
    unittest.main()
