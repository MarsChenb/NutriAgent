"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { DailySummary, MealLog, UserProfile } from "@/lib/types";

type MealSectionKey = "breakfast" | "lunch" | "dinner" | "snack";

type MealSectionConfig = {
  key: MealSectionKey | "exercise";
  title: string;
  emoji: string;
  targetRatio?: number;
  cta: string;
};

const mealSections: MealSectionConfig[] = [
  { key: "breakfast", title: "早餐", emoji: "早", targetRatio: 0.25, cta: "记早餐" },
  { key: "lunch", title: "午餐", emoji: "午", targetRatio: 0.35, cta: "记午餐" },
  { key: "dinner", title: "晚餐", emoji: "晚", targetRatio: 0.3, cta: "记晚餐" },
  { key: "snack", title: "加餐", emoji: "加", targetRatio: 0.1, cta: "记加餐" },
  { key: "exercise", title: "运动", emoji: "动", cta: "去记录" },
];

function buildWeekDays(selectedDate: Date) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function getWeeklyGoalKg(profile: UserProfile) {
  if (!profile.weight_delta_kg || profile.weight_delta_kg <= 0) {
    return 0;
  }
  switch (profile.goal_type) {
    case "fat_loss":
      return Math.min(0.6, Number((profile.weight_delta_kg / 10).toFixed(2)) || 0.4);
    case "health":
      return 0.3;
    case "energy":
      return 0.2;
    case "detox":
      return 0.2;
    default:
      return 0.3;
  }
}

function getMealTarget(totalTarget: number, ratio = 0) {
  return Math.round(totalTarget * ratio);
}

function groupMealsByType(meals: MealLog[]) {
  const initial: Record<MealSectionKey, MealLog[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const meal of meals) {
    const key = (meal.meal_type as MealSectionKey) || "snack";
    initial[key].push(meal);
  }

  return initial;
}

function caloriesOfMeals(meals: MealLog[]) {
  return meals.reduce((sum, meal) => sum + (meal.total_calories_kcal || 0), 0);
}

function MacroMeter({ label, value, target, tone }: { label: string; value: number; target: number; tone: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value.toFixed(0)}/{target.toFixed(0)}g</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SummaryDonut({ consumed, target }: { consumed: number; target: number }) {
  const percentage = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="136" height="136" className="-rotate-90">
        <circle cx="68" cy="68" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="none"
          stroke="#0f172a"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold text-slate-950">{Math.round(consumed)}</div>
        <div className="text-xs text-slate-500">/ {target} kcal</div>
      </div>
    </div>
  );
}

function readDateFromLocation() {
  if (typeof window === "undefined") {
    return new Date();
  }
  const value = new URLSearchParams(window.location.search).get("date");
  return value ? parseISO(value) : new Date();
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
      return "未设定目标";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(readDateFromLocation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickInput, setQuickInput] = useState("");

  useEffect(() => {
    setSelectedDate(readDateFromLocation());
  }, []);

  useEffect(() => {
    const nextUrl = `/?date=${format(selectedDate, "yyyy-MM-dd")}`;
    window.history.replaceState({}, "", nextUrl);
    void loadDashboard(selectedDate);
  }, [selectedDate]);

  async function loadDashboard(date: Date) {
    setLoading(true);
    setError(null);
    const dateString = format(date, "yyyy-MM-dd");

    try {
      const profileRes = await api.get<UserProfile>("/users/me/profile");
      if (!profileRes.data.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      const [summaryRes, mealsRes] = await Promise.all([
        api.get<DailySummary>("/meals/daily-summary", { params: { summary_date: dateString } }),
        api.get<MealLog[]>("/meals/", { params: { meal_date: dateString } }),
      ]);

      setProfile(profileRes.data);
      setSummary(summaryRes.data);
      setMeals(mealsRes.data);
    } catch (loadError) {
      console.error(loadError);
      setError("首页数据加载失败，请确认后端服务可用。");
    } finally {
      setLoading(false);
    }
  }

  function goToMealRecorder(mealType: MealSectionKey = "lunch", mode: "text" | "image" = "text") {
    const params = new URLSearchParams({
      mealType,
      date: format(selectedDate, "yyyy-MM-dd"),
      mode,
    });
    if (quickInput.trim()) {
      params.set("prefill", quickInput.trim());
    }
    router.push(`/meals?${params.toString()}`);
  }

  const weekDays = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const groupedMeals = useMemo(() => groupMealsByType(meals), [meals]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">正在加载今日健康工作台...</div>;
  }

  if (error || !profile || !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full rounded-[28px] border border-white/70 bg-white/90 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">NutriAgent</h1>
          <p className="mt-2 text-sm text-slate-500">今日健康工作台</p>
          <p className="mt-5 text-sm text-rose-500">{error || "首页初始化失败。"}</p>
          <button onClick={() => void loadDashboard(selectedDate)} className="mt-6 rounded-full bg-slate-950 px-5 py-2 text-sm text-white">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const coach = getCoachPersona(profile.coach_persona);
  const calorieTarget = summary.calorie_target || profile.daily_calorie_target || 2000;
  const consumedCalories = summary.total_calories_kcal || 0;
  const burnedCalories = 0;
  const remainingCalories = Math.max(0, Math.round((summary.calorie_remaining_kcal ?? calorieTarget - consumedCalories) + burnedCalories));
  const weeklyGoalKg = getWeeklyGoalKg(profile);

  return (
    <div className="px-4 pb-28 pt-4">
      <section className={`rounded-[30px] bg-gradient-to-br ${coach.gradientClass} p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)]`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">当前教练</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{coach.name}</h1>
            <p className="mt-2 max-w-[14rem] text-sm/6 text-white/90">{coach.tagline}</p>
          </div>
          <button onClick={() => router.push("/onboarding")} className="rounded-full border border-white/35 px-3 py-1 text-xs text-white/90">
            编辑建档
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
            <div className="text-xs text-white/70">本周目标</div>
            <div className="mt-2 text-xl font-semibold">瘦 {weeklyGoalKg.toFixed(2)} kg</div>
          </div>
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
            <div className="text-xs text-white/70">今日状态</div>
            <div className="mt-2 text-xl font-semibold">{goalLabel(profile.goal_type)}</div>
          </div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">日期切换</p>
            <h2 className="text-xl font-semibold text-slate-950">{format(selectedDate, "M月d日 EEEE", { locale: zhCN })}</h2>
          </div>
          <button onClick={() => setSelectedDate(new Date())} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
            回到今天
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const active = format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`rounded-2xl px-2 py-3 text-center transition ${active ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
              >
                <div className="text-[11px] uppercase">{format(day, "EEE", { locale: zhCN })}</div>
                <div className="mt-1 text-lg font-semibold">{format(day, "d")}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">今日热量预算</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">还可摄入 {remainingCalories} kcal</h3>
            <p className="mt-2 text-sm text-slate-500">饮食摄入 {Math.round(consumedCalories)} kcal · 运动消耗 {burnedCalories} kcal</p>
          </div>
          <SummaryDonut consumed={consumedCalories} target={calorieTarget} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">热量缺口 / 剩余</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{remainingCalories} kcal</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">饮食摄入</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(consumedCalories)} kcal</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <MacroMeter label="碳水" value={summary.total_carb_g || 0} target={profile.carb_target_g || 250} tone="bg-fuchsia-500" />
          <MacroMeter label="蛋白质" value={summary.total_protein_g || 0} target={profile.protein_target_g || 100} tone="bg-sky-500" />
          <MacroMeter label="脂肪" value={summary.total_fat_g || 0} target={profile.fat_target_g || 70} tone="bg-amber-500" />
        </div>
      </section>

      <section className="mt-5 space-y-3">
        {mealSections.map((section) => {
          if (section.key === "exercise") {
            return (
              <div key={section.key} className="rounded-[26px] border border-white/70 bg-white/92 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">{section.emoji}</div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-950">{section.title}</h4>
                      <p className="text-sm text-slate-500">{burnedCalories} / 0 kcal</p>
                    </div>
                  </div>
                  <button onClick={() => router.push("/chat")} className="rounded-full bg-slate-950 px-4 py-2 text-xs text-white">
                    {section.cta}
                  </button>
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  运动记录模块将在下一步接入。当前先保留入口，后续会在这里展示手动运动记录和消耗热量。
                </div>
              </div>
            );
          }

          const sectionMeals = groupedMeals[section.key];
          const sectionCalories = caloriesOfMeals(sectionMeals);
          const sectionTarget = getMealTarget(calorieTarget, section.targetRatio);

          return (
            <div key={section.key} className="rounded-[26px] border border-white/70 bg-white/92 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">{section.emoji}</div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-950">{section.title}</h4>
                    <p className="text-sm text-slate-500">{Math.round(sectionCalories)} / {sectionTarget} kcal</p>
                  </div>
                </div>
                <button onClick={() => router.push(`/meals?mealType=${section.key}&date=${format(selectedDate, "yyyy-MM-dd")}`)} className="rounded-full bg-slate-950 px-4 py-2 text-xs text-white">
                  {section.cta}
                </button>
              </div>

              {sectionMeals.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  这餐还没有记录。点击右上角开始补录，系统会自动更新今日热量和营养进度。
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {sectionMeals.map((meal) => (
                    <div key={meal.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium text-slate-800">{meal.items.map((item) => item.recognized_name).filter(Boolean).join("、") || "未命名餐食"}</div>
                        <div className="font-semibold text-orange-500">{Math.round(meal.total_calories_kcal || 0)} kcal</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{format(new Date(meal.created_at), "HH:mm")} · {meal.items.length} 个食物项</div>
                      {meal.ai_summary && <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-slate-600">{meal.ai_summary}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="fixed bottom-16 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
        <div className="rounded-[28px] border border-white/70 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <input
              value={quickInput}
              onChange={(event) => setQuickInput(event.target.value)}
              placeholder="快速记一口，例如：晚餐吃了鸡胸肉和沙拉"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button onClick={() => goToMealRecorder("lunch", "text")} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
              文本
            </button>
            <button onClick={() => goToMealRecorder("lunch", "image")} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
              相机
            </button>
            <button onClick={() => router.push("/chat")} className="rounded-full bg-slate-950 px-3 py-2 text-xs text-white">
              AI 助教
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
