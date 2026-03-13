"use client";
import { useState } from "react";
import api from "@/lib/api";
import type { ParsedFood } from "@/lib/types";

export default function MealsPage() {
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [parsedItems, setParsedItems] = useState<ParsedFood[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setResult(null);
    try {
      const res = await api.post("/meals/parse", { text, meal_type: mealType });
      setParsedItems(res.data.items);
    } catch (e) {
      alert("解析失败，请重试");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    const validItems = parsedItems.filter(i => i.food_id);
    if (validItems.length === 0) {
      alert("没有可记录的食物");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/meals/", {
        meal_type: mealType,
        items: validItems.map(i => ({ food_id: i.food_id, amount_g: i.amount_g })),
        raw_input: text,
      });
      const totalCal = Math.round(res.data.total_calories_kcal);
      setResult(`记录成功！本餐合计 ${totalCal} kcal`);
      setParsedItems([]);
      setText("");
    } catch (e) {
      alert("记录失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">记录饮食</h1>

      {/* Meal Type Selector */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "breakfast", label: "早餐" },
          { key: "lunch", label: "午餐" },
          { key: "dinner", label: "晚餐" },
          { key: "snack", label: "加餐" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMealType(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              mealType === key
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Text Input */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4">
        <textarea
          className="w-full border-0 resize-none text-sm focus:outline-none placeholder:text-gray-400"
          rows={3}
          placeholder="描述你吃了什么... 例如：两个鸡蛋、一杯牛奶、两片全麦面包"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="bg-green-500 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition"
          >
            {parsing ? "AI 解析中..." : "解析食物"}
          </button>
        </div>
      </div>

      {/* Parsed Results */}
      {parsedItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-600 mb-3">识别结果</h3>
          <div className="space-y-2">
            {parsedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-sm font-medium">{item.food_name}</span>
                  <span className="text-xs text-gray-400 ml-2">{item.amount_g}g</span>
                  {!item.food_id && (
                    <span className="text-xs text-red-400 ml-2">(未匹配)</span>
                  )}
                </div>
                <span className="text-sm text-orange-500 font-medium">
                  {item.calories_kcal != null ? `${Math.round(item.calories_kcal)} kcal` : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <span className="text-sm font-medium">
              合计：{Math.round(parsedItems.reduce((s, i) => s + (i.calories_kcal || 0), 0))} kcal
            </span>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {saving ? "记录中..." : "确认记录"}
            </button>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 font-medium">{result}</p>
        </div>
      )}
    </div>
  );
}
