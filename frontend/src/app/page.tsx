"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { DailySummary, MealLog } from "@/lib/types";

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const percentage = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = percentage > 100 ? "#ef4444" : percentage > 80 ? "#f59e0b" : "#22c55e";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="150" height="150" className="-rotate-90">
        <circle cx="75" cy="75" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold">{Math.round(consumed)}</div>
        <div className="text-xs text-gray-500">/ {target} kcal</div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="flex-1">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs font-medium mt-1">{value.toFixed(1)}g</div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, mealsRes] = await Promise.all([
        api.get("/meals/daily-summary"),
        api.get("/meals/"),
      ]);
      setSummary(summaryRes.data);
      setMeals(mealsRes.data);
    } catch (e) {
      console.error(e);
      setError("加载数据失败，请确认后端服务已启动并可访问。");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-gray-400">加载中...</div></div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">NutriAgent</h1>
          <p className="mt-2 text-sm text-gray-500">单用户 AI 营养管理助手</p>
          <p className="mt-6 text-sm text-red-500">{error}</p>
          <button
            onClick={loadData}
            className="mt-6 rounded-full bg-green-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-600"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const target = summary?.calorie_target || 2000;
  const consumed = summary?.total_calories_kcal || 0;

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">NutriAgent</h1>
          <p className="text-sm text-gray-500">单用户 AI 营养管理助手</p>
        </div>
        <div className="text-sm text-gray-400">
          {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-gray-600">今日热量</h2>
        <div className="flex items-center justify-around">
          <CalorieRing consumed={consumed} target={target} />
          <div className="space-y-3">
            <MacroBar label="蛋白质" value={summary?.total_protein_g || 0} target={100} color="bg-blue-500" />
            <MacroBar label="脂肪" value={summary?.total_fat_g || 0} target={70} color="bg-yellow-500" />
            <MacroBar label="碳水" value={summary?.total_carb_g || 0} target={250} color="bg-orange-500" />
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-gray-500">
          还可以吃 <span className="font-bold text-green-600">{Math.max(0, Math.round(summary?.calorie_remaining_kcal || target))}</span> 千卡
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-600">今日餐食</h2>
        {meals.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">还没有记录，去 meals 页面记下今天吃了什么。</p>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                <div>
                  <span className="text-sm font-medium">
                    {meal.meal_type === "breakfast"
                      ? "早餐"
                      : meal.meal_type === "lunch"
                        ? "午餐"
                        : meal.meal_type === "dinner"
                          ? "晚餐"
                          : "加餐"}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">
                    {meal.items.map((item) => item.recognized_name).filter(Boolean).join("、") || "未命名餐食"}
                  </p>
                </div>
                <span className="text-sm font-bold text-orange-500">{Math.round(meal.total_calories_kcal || 0)} kcal</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
