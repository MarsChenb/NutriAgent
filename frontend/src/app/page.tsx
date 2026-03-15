"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { DailySummary, MealLog, UserProfile } from "@/lib/types";

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
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs font-medium">{value.toFixed(1)}g</div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
      const profileRes = await api.get<UserProfile>("/users/me/profile");
      if (!profileRes.data.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      const [summaryRes, mealsRes] = await Promise.all([
        api.get<DailySummary>("/meals/daily-summary"),
        api.get<MealLog[]>("/meals/"),
      ]);
      setProfile(profileRes.data);
      setSummary(summaryRes.data);
      setMeals(mealsRes.data);
    } catch (loadError) {
      console.error(loadError);
      setError("加载数据失败，请确认后端服务已启动并可访问。");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="text-slate-400">正在加载今日健康工作台...</div></div>;
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">NutriAgent</h1>
          <p className="mt-2 text-sm text-slate-500">单用户 AI 健康教练</p>
          <p className="mt-6 text-sm text-rose-500">{error || "用户画像读取失败。"}</p>
          <button onClick={loadData} className="mt-6 rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const coach = getCoachPersona(profile.coach_persona);
  const target = summary?.calorie_target || profile.daily_calorie_target || 2000;
  const consumed = summary?.total_calories_kcal || 0;
  const remaining = Math.max(0, Math.round(summary?.calorie_remaining_kcal ?? target - consumed));

  return (
    <div className="p-4 pb-24">
      <div className={`rounded-[30px] bg-gradient-to-br ${coach.gradientClass} p-6 text-white shadow-[0_20px_70px_rgba(79,70,229,0.25)]`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">你的专属私教</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{coach.name}</h1>
            <p className="mt-2 max-w-[15rem] text-sm/6 text-white/90">{coach.tagline}</p>
          </div>
          <div className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.18em]">{coach.mbti}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/16 p-4 backdrop-blur">
            <div className="text-white/70">当前目标</div>
            <div className="mt-2 text-lg font-semibold">{goalLabel(profile.goal_type)}</div>
          </div>
          <div className="rounded-2xl bg-white/16 p-4 backdrop-blur">
            <div className="text-white/70">计划减重</div>
            <div className="mt-2 text-lg font-semibold">{profile.weight_delta_kg ? `${profile.weight_delta_kg} kg` : "待设定"}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">今日热量预算</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">还可吃 {remaining} kcal</h2>
          </div>
          <button onClick={() => router.push("/onboarding")} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">编辑建档</button>
        </div>
        <div className="flex items-center justify-around">
          <CalorieRing consumed={consumed} target={target} />
          <div className="space-y-3">
            <MacroBar label="蛋白质" value={summary?.total_protein_g || 0} target={profile.protein_target_g || 100} color="bg-sky-500" />
            <MacroBar label="脂肪" value={summary?.total_fat_g || 0} target={profile.fat_target_g || 70} color="bg-amber-500" />
            <MacroBar label="碳水" value={summary?.total_carb_g || 0} target={profile.carb_target_g || 250} color="bg-fuchsia-500" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-sm">
          <div className="text-slate-500">BMI</div>
          <div className="mt-2 text-2xl font-semibold">{profile.bmi ?? "--"}</div>
          <div className="mt-2 text-xs text-slate-400">根据身高与当前体重估算</div>
        </div>
        <div className="rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-sm">
          <div className="text-slate-500">运动习惯</div>
          <div className="mt-2 text-2xl font-semibold">{activityLabel(profile.activity_level)}</div>
          <div className="mt-2 text-xs text-slate-400">后续首页会基于它生成更合适的计划</div>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">今日餐食记录</h3>
          <button onClick={() => router.push("/meals")} className="rounded-full bg-slate-950 px-3 py-1.5 text-xs text-white">去记录</button>
        </div>
        {meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            还没有记录。先去写下早餐、午餐或晚餐，系统就能开始计算热量和营养进度。
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{mealTypeLabel(meal.meal_type)}</span>
                  <span className="text-sm font-semibold text-orange-500">{Math.round(meal.total_calories_kcal || 0)} kcal</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{meal.items.map((item) => item.recognized_name).filter(Boolean).join("、") || "未命名餐食"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function mealTypeLabel(mealType: string | null) {
  switch (mealType) {
    case "breakfast":
      return "早餐";
    case "lunch":
      return "午餐";
    case "dinner":
      return "晚餐";
    default:
      return "加餐";
  }
}

function goalLabel(goalType: string | null) {
  switch (goalType) {
    case "fat_loss":
      return "减脂塑形";
    case "health":
      return "更健康";
    case "energy":
      return "更有活力";
    case "detox":
      return "饮食重置";
    default:
      return "未设定";
  }
}

function activityLabel(activity: string | null) {
  switch (activity) {
    case "sedentary":
      return "低";
    case "light":
      return "轻";
    case "moderate":
      return "中";
    case "high":
      return "高";
    default:
      return "待设定";
  }
}
