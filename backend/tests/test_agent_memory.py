import unittest

from app.agents.memory import build_profile_memories, format_conversation_context, format_memory_context


class MemoryTests(unittest.TestCase):
    def test_build_profile_memories_extracts_goal_and_restrictions(self):
        profile = {
            "goal_type": "fat_loss",
            "activity_level": "moderate",
            "taste_preference": "清淡",
            "allergies": "花生",
            "dietary_restrictions": "少糖",
            "medical_history": "胃炎",
        }

        memories = build_profile_memories(profile)
        texts = [item["memory_text"] for item in memories]

        self.assertTrue(any("当前目标是 fat_loss" in text for text in texts))
        self.assertTrue(any("过敏信息: 花生" in text for text in texts))
        self.assertTrue(any("饮食限制: 少糖" in text for text in texts))

    def test_memory_context_formatting(self):
        memory_text = format_memory_context(
            [{"memory_type": "goal", "memory_text": "当前目标是 fat_loss", "importance_score": 0.95}]
        )
        conversation_text = format_conversation_context(
            [{"role": "user", "message_text": "今天还能吃什么"}, {"role": "assistant", "message_text": "还可以安排一顿高蛋白晚餐"}]
        )

        self.assertIn("[goal]", memory_text)
        self.assertIn("user: 今天还能吃什么", conversation_text)


if __name__ == "__main__":
    unittest.main()
