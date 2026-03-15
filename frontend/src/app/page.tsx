"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { DailySummary, ExerciseLog, MealLog, UserProfile } from "@/lib/types";

type MealSectionKey = "breakfast" | "lunch" | "dinner" | "snack";

type MealSectionConfig = {
  key: MealSectionKey | "exercise";
  title: string;
  icon: string;
  targetRatio?: number;
  cta: string;
  hint: string;
};

const mealSections: MealSectionConfig[] = [
  { key: "breakfast", title: "早餐", icon: "朝", targetRatio: 0.25, cta: "记早餐", hint: "给上午的代谢打个好底子" },
  { key: "lunch", title: "午餐", icon: "午", targetRatio: 0.35, cta: "记午餐", hint: "主餐吃稳，下午不容易乱饿" },
  { key: "dinner", title: "晚餐", icon: "晚", targetRatio: 0.3, cta: "记晚餐", hint: "晚间控制住，缺口更容易守住" },
  { key: "snack", title: "加餐", icon: "加", targetRatio: 0.1, cta: "记加餐", hint: "零食也算数，记了才准" },
  { key: "exercise", title: "运动", icon: "动", cta: "记运动", hint: "记录训练后，热量缺口会自动更新" },
];

const exerciseTypeLabels: Record<string, string> = {
  walking: "步行",
  running: "跑步",
  cycling: "骑行",
  strength: "力量训练",
  hiit: "HIIT",
  yoga: "瑜伽拉伸",
  swimming: "游泳",
  other: "其他运动",
};

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

function statusCopy(remainingCalories: number, calorieDeficit: number) {
  if (remainingCalories > 600) {
    return "今天空间还很充足，可以从容安排下一餐。";
  }
  if (remainingCalories > 200) {
    return "今天节奏不错，下一餐继续稳住即可。";
  }
  if (calorieDeficit < 0) {
    return "今天已经超出预算，下一餐建议轻一点。";
  }
  return "今天快收口了，优先补蛋白和蔬菜。";
}

function MacroCard({ label, value, target, toneClass }: { label: string; value: number; target: number; toneClass: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;

  return (
    <div className="rounded-[22px] bg-slate-50/85 p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>
          {value.toFixed(0)}/{target.toFixed(0)}g
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SummaryRing({ consumed, target }: { consumed: number; target: number }) {
  const percentage = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex h-[148px] w-[148px] items-center justify-center rounded-full bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <svg width="136" height="136" className="-rotate-90">
        <circle cx="68" cy="68" r={radius} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="10" />
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
        <div className="text-[32px] font-semibold tracking-tight text-slate-950">{Math.round(consumed)}</div>
        <div className="text-xs text-slate-500">/ {target} kcal</div>
      </div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/85 px-4 py-4 text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
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

      const [summaryRes, mealsRes, exercisesRes] = await Promise.all([
        api.get<DailySummary>("/meals/daily-summary", { params: { summary_date: dateString } }),
        api.get<MealLog[]>("/meals/", { params: { meal_date: dateString } }),
        api.get<ExerciseLog[]>("/exercises/", { params: { exercise_date: dateString } }),
      ]);

      setProfile(profileRes.data);
      setSummary(summaryRes.data);
      setMeals(mealsRes.data);
      setExercises(exercisesRes.data);
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

  function goToExerciseRecorder() {
    const params = new URLSearchParams({ date: format(selectedDate, "yyyy-MM-dd") });
    if (quickInput.trim()) {
      params.set("prefill", quickInput.trim());
    }
    router.push(`/exercise?${params.toString()}`);
  }

  const weekDays = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const groupedMeals = useMemo(() => groupMealsByType(meals), [meals]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[32px] border border-white/70 bg-white/90 p-7 text-center shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-slate-900" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">今日健康工作台</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">正在同步今日饮食、运动和教练反馈...</p>
        </div>
      </div>
    );
  }

  if (error || !profile || !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[32px] border border-white/70 bg-white/92 p-7 text-center shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl">!</div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">NutriAgent</h1>
          <p className="mt-2 text-sm text-slate-500">首页暂时没有准备好</p>
          <p className="mt-5 text-sm leading-6 text-rose-500">{error || "首页初始化失败。"}</p>
          <button onClick={() => void loadDashboard(selectedDate)} className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-sm text-white">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const coach = getCoachPersona(profile.coach_persona);
  const calorieTarget = summary.calorie_target || profile.daily_calorie_target || 2000;
  const consumedCalories = summary.total_calories_kcal || 0;
  const burnedCalories = summary.total_exercise_calories_kcal || 0;
  const remainingCalories = Math.max(0, Math.round(summary.calorie_remaining_kcal ?? calorieTarget - consumedCalories + burnedCalories));
  const calorieDeficit = Math.round(summary.calorie_deficit_kcal ?? calorieTarget + burnedCalories - consumedCalories);
  const weeklyGoalKg = getWeeklyGoalKg(profile);
  const activeMealCount = meals.length;
  const statusText = statusCopy(remainingCalories, calorieDeficit);
  const weightGap = profile.weight_delta_kg ? `${profile.weight_delta_kg.toFixed(1)} kg` : "未设置";

  return (
    <div className="relative px-4 pb-36 pt-4 md:px-6 md:pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),transparent_68%)]" />

      <section className={`relative overflow-hidden rounded-[34px] bg-gradient-to-br ${coach.gradientClass} p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] md:p-7`}>
        <div className="absolute -right-10 top-6 h-32 w-32 rounded-full bg-white/12 blur-2xl" />
        <div className="absolute bottom-0 left-1/2 h-24 w-40 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs text-white/80 backdrop-blur">
              <span className="text-[10px] tracking-[0.28em]">AI HEALTH COACH</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">{coach.mbti}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/18 text-lg font-semibold backdrop-blur">{coach.name.slice(0, 1)}</div>
              <div>
                <p className="text-sm text-white/80">当前私教</p>
                <h1 className="text-[30px] font-semibold tracking-tight">{coach.name}</h1>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/88">{coach.tagline}。{statusText}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[320px]">
            <div className="rounded-[24px] bg-white/14 p-4 backdrop-blur">
              <div className="text-xs text-white/70">本周目标</div>
              <div className="mt-2 text-2xl font-semibold">-{weeklyGoalKg.toFixed(2)} kg</div>
              <div className="mt-2 text-xs text-white/75">目标体重差值 {weightGap}</div>
            </div>
            <div className="rounded-[24px] bg-white/14 p-4 backdrop-blur">
              <div className="text-xs text-white/70">今日重点</div>
              <div className="mt-2 text-2xl font-semibold">{goalLabel(profile.goal_type)}</div>
              <div className="mt-2 text-xs text-white/75">{activeMealCount} 条餐食 · {summary.exercise_count} 条运动</div>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <button onClick={() => router.push("/review")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            看本周复盘
          </button>
          <button onClick={() => router.push("/chat")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            问问 {coach.name}
          </button>
          <button onClick={() => router.push("/onboarding")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            调整建档
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-[30px] border border-white/70 bg-white/88 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Week Flow</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{format(selectedDate, "M月d日 EEEE", { locale: zhCN })}</h2>
            <p className="mt-1 text-sm text-slate-500">按天切换，快速回看每一餐和运动消耗。</p>
          </div>
          <button onClick={() => setSelectedDate(new Date())} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
            回到今天
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 md:gap-3">
          {weekDays.map((day) => {
            const active = isSameDay(day, selectedDate);
            const today = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`rounded-[22px] px-1 py-3 text-center transition ${
                  active
                    ? "bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)]"
                    : "bg-slate-50/90 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="text-[11px] tracking-wide opacity-80">{format(day, "EEE", { locale: zhCN })}</div>
                <div className="mt-1 text-lg font-semibold">{format(day, "d")}</div>
                <div className={`mt-1 text-[10px] ${active ? "text-white/80" : today ? "text-emerald-600" : "text-slate-400"}`}>
                  {today ? "今天" : ""}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Today Budget</p>
              <h3 className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">还可摄入 {remainingCalories} kcal</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">今天吃了 {Math.round(consumedCalories)} kcal，运动消耗 {Math.round(burnedCalories)} kcal。核心目标是把缺口稳定在舒服、能长期执行的范围内。</p>
            </div>
            <SummaryRing consumed={consumedCalories} target={calorieTarget + burnedCalories} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] bg-slate-950 px-4 py-4 text-white shadow-[0_16px_28px_rgba(15,23,42,0.18)]">
              <div className="text-xs text-white/65">热量缺口</div>
              <div className="mt-2 text-3xl font-semibold">{calorieDeficit}</div>
              <div className="mt-2 text-xs text-white/65">建议持续，不靠极端节食。</div>
            </div>
            <div className="rounded-[24px] bg-emerald-50 px-4 py-4 text-emerald-950">
              <div className="text-xs text-emerald-700/70">饮食摄入</div>
              <div className="mt-2 text-3xl font-semibold">{Math.round(consumedCalories)}</div>
              <div className="mt-2 text-xs text-emerald-700/70">目标 {calorieTarget} kcal</div>
            </div>
            <div className="rounded-[24px] bg-sky-50 px-4 py-4 text-sky-950">
              <div className="text-xs text-sky-700/70">运动消耗</div>
              <div className="mt-2 text-3xl font-semibold">{Math.round(burnedCalories)}</div>
              <div className="mt-2 text-xs text-sky-700/70">已记录 {summary.exercise_count} 次</div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Macros</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">三大营养素进度</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">按今日目标</div>
          </div>
          <div className="mt-5 space-y-3">
            <MacroCard label="碳水" value={summary.total_carb_g || 0} target={profile.carb_target_g || 250} toneClass="bg-fuchsia-500" />
            <MacroCard label="蛋白质" value={summary.total_protein_g || 0} target={profile.protein_target_g || 100} toneClass="bg-sky-500" />
            <MacroCard label="脂肪" value={summary.total_fat_g || 0} target={profile.fat_target_g || 70} toneClass="bg-amber-500" />
          </div>

          <div className="mt-5 rounded-[24px] bg-slate-50/90 p-4 text-sm leading-7 text-slate-600">
            <div className="font-medium text-slate-900">{coach.name} 的今日提醒</div>
            <p className="mt-2">{statusText}</p>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Daily Flow</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">按餐次管理今天</h3>
          </div>
          <p className="text-sm text-slate-500">吃和动都在这页完成</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {mealSections.map((section) => {
            if (section.key === "exercise") {
              return (
                <div key={section.key} className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-950 text-lg font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">{section.icon}</div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{section.title}</p>
                        <h4 className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(burnedCalories)} kcal</h4>
                        <p className="mt-2 text-sm text-slate-500">{section.hint}</p>
                      </div>
                    </div>
                    <button onClick={goToExerciseRecorder} className="rounded-full bg-slate-950 px-4 py-2 text-xs text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)]">
                      {section.cta}
                    </button>
                  </div>

                  {exercises.length === 0 ? (
                    <EmptyBlock text="还没有运动记录。补一条训练数据后，首页会自动重算今日热量缺口。" />
                  ) : (
                    <div className="mt-4 space-y-3">
                      {exercises.slice(0, 3).map((exercise) => (
                        <div key={exercise.id} className="rounded-[24px] bg-slate-50/85 p-4">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <div>
                              <div className="font-medium text-slate-800">{exerciseTypeLabels[exercise.exercise_type] || exercise.exercise_type}</div>
                              <div className="mt-1 text-xs text-slate-500">{format(new Date(exercise.created_at), "HH:mm")} · {exercise.duration_minutes} 分钟</div>
                            </div>
                            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">-{Math.round(exercise.calories_burned_kcal)} kcal</div>
                          </div>
                          {exercise.notes && <div className="mt-3 text-sm text-slate-600">备注：{exercise.notes}</div>}
                          {exercise.ai_summary && <div className="mt-3 rounded-[20px] bg-white px-3 py-3 text-sm leading-6 text-slate-600">{exercise.ai_summary}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            const sectionMeals = groupedMeals[section.key];
            const sectionCalories = caloriesOfMeals(sectionMeals);
            const sectionTarget = getMealTarget(calorieTarget, section.targetRatio);

            return (
              <div key={section.key} className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-950 text-lg font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">{section.icon}</div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{section.title}</p>
                      <h4 className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(sectionCalories)} / {sectionTarget} kcal</h4>
                      <p className="mt-2 text-sm text-slate-500">{section.hint}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/meals?mealType=${section.key}&date=${format(selectedDate, "yyyy-MM-dd")}`)}
                    className="rounded-full bg-slate-950 px-4 py-2 text-xs text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)]"
                  >
                    {section.cta}
                  </button>
                </div>

                {sectionMeals.length === 0 ? (
                  <EmptyBlock text="这餐还没有记录。点右上角补录后，今日热量和营养进度会立刻更新。" />
                ) : (
                  <div className="mt-4 space-y-3">
                    {sectionMeals.slice(0, 3).map((meal) => (
                      <div key={meal.id} className="rounded-[24px] bg-slate-50/85 p-4">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <div>
                            <div className="font-medium text-slate-800">{meal.items.map((item) => item.recognized_name).filter(Boolean).join("、") || "未命名餐食"}</div>
                            <div className="mt-1 text-xs text-slate-500">{format(new Date(meal.created_at), "HH:mm")} · {meal.items.length} 个食物项</div>
                          </div>
                          <div className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">{Math.round(meal.total_calories_kcal || 0)} kcal</div>
                        </div>
                        {meal.ai_summary && <div className="mt-3 rounded-[20px] bg-white px-3 py-3 text-sm leading-6 text-slate-600">{meal.ai_summary}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-4 md:bottom-28">
        <div className="rounded-[30px] border border-white/80 bg-white/92 p-3 shadow-[0_24px_40px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-medium text-slate-900">快速记录</div>
              <div className="text-xs text-slate-500">一句话记饮食，或直接跳转 AI 助教</div>
            </div>
            <button onClick={() => router.push("/chat")} className={`rounded-full px-3 py-1.5 text-xs font-medium ${coach.accentClass} bg-white shadow-sm`}>
              {coach.name} 在线
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-[22px] bg-slate-50 px-3 py-3">
            <input
              value={quickInput}
              onChange={(event) => setQuickInput(event.target.value)}
              placeholder="例如：晚餐吃了鸡胸肉、南瓜和酸奶"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button onClick={() => goToMealRecorder("lunch", "text")} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
              文本
            </button>
            <button onClick={() => goToMealRecorder("lunch", "image")} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
              相机
            </button>
            <button onClick={() => router.push("/chat")} className="rounded-full bg-slate-950 px-3 py-2 text-xs text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)]">
              AI 助教
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

