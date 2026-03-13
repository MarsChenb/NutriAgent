"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { DailySummary, MealLog } from "@/lib/types";

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const percentage = Math.min((consumed / target) * 100, 100);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = percentage > 100 ? "#ef4444" : percentage > 80 ? "#f59e0b" : "#22c55e";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="150" height="150" className="-rotate-90">
        <circle cx="75" cy="75" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="75" cy="75" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" className="transition-all duration-700"
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
  const pct = Math.min((value / target) * 100, 100);
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
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setLoggedIn(true);
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadData() {
    try {
      const [summaryRes, mealsRes] = await Promise.all([
        api.get("/meals/daily-summary"),
        api.get("/meals/"),
      ]);
      setSummary(summaryRes.data);
      setMeals(mealsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(username: string, password: string) {
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.access_token);
      setLoggedIn(true);
      loadData();
    } catch {
      try {
        const res = await api.post("/auth/register", { username, password });
        localStorage.setItem("token", res.data.access_token);
        setLoggedIn(true);
        loadData();
      } catch (e) {
        alert("登录失败");
      }
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-gray-400">加载中...</div></div>;
  }

  if (!loggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const target = summary?.calorie_target || 2000;
  const consumed = summary?.total_calories_kcal || 0;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">NutriAgent</h1>
          <p className="text-sm text-gray-500">AI 营养管理助手</p>
        </div>
        <div className="text-sm text-gray-400">
          {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}
        </div>
      </div>

      {/* Calorie Ring */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
        <h2 className="text-sm font-medium text-gray-600 mb-4">今日热量</h2>
        <div className="flex items-center justify-around">
          <CalorieRing consumed={consumed} target={target} />
          <div className="space-y-3">
            <MacroBar label="蛋白质" value={summary?.total_protein_g || 0} target={100} color="bg-blue-500" />
            <MacroBar label="脂肪" value={summary?.total_fat_g || 0} target={70} color="bg-yellow-500" />
            <MacroBar label="碳水" value={summary?.total_carb_g || 0} target={250} color="bg-orange-500" />
          </div>
        </div>
        <div className="text-center mt-4 text-sm text-gray-500">
          还可以吃 <span className="font-bold text-green-600">{Math.max(0, Math.round(summary?.calorie_remaining_kcal || target))}</span> 千卡
        </div>
      </div>

      {/* Recent Meals */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <h2 className="text-sm font-medium text-gray-600 mb-3">今日餐食</h2>
        {meals.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">还没有记录，快去记录你的饮食吧！</p>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-sm font-medium">
                    {meal.meal_type === "breakfast" ? "早餐" : meal.meal_type === "lunch" ? "午餐" : meal.meal_type === "dinner" ? "晚餐" : "加餐"}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {meal.items.map(i => i.recognized_name).filter(Boolean).join("、")}
                  </p>
                </div>
                <span className="text-sm font-bold text-orange-500">
                  {Math.round(meal.total_calories_kcal || 0)} kcal
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginForm({ onLogin }: { onLogin: (u: string, p: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex items-center justify-center h-screen p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">NutriAgent</h1>
        <p className="text-gray-500 text-center mb-8">AI 智能营养管理助手</p>
        <input
          className="w-full border rounded-xl px-4 py-3 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)}
        />
        <input
          className="w-full border rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)}
        />
        <button
          onClick={() => onLogin(username, password)}
          className="w-full bg-green-500 text-white rounded-xl py-3 font-medium hover:bg-green-600 transition"
        >
          登录 / 注册
        </button>
      </div>
    </div>
  );
}
