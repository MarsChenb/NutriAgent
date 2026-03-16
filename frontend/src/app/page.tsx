"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Camera,
  ChevronRight,
  Dumbbell,
  MoonStar,
  PencilLine,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  UtensilsCrossed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { DailySummary, ExerciseLog, MealLog, UserProfile } from "@/lib/types";

type MealSectionKey = "breakfast" | "lunch" | "dinner" | "snack";

const mealMeta: Record<
  MealSectionKey,
  {
    title: string;
    hint: string;
    icon: typeof Sunrise;
    tone: string;
  }
> = {
  breakfast: {
    title: "早餐",
    hint: "先把蛋白质和主食稳住，上午更不容易乱吃。",
    icon: Sunrise,
    tone: "bg-amber-50 text-amber-700",
  },
  lunch: {
    title: "午餐",
    hint: "中午吃得更清晰，下午的状态会稳定很多。",
    icon: Sun,
    tone: "bg-sky-50 text-sky-700",
  },
  dinner: {
    title: "晚餐",
    hint: "控制晚间热量波动，是保住缺口的关键。",
    icon: MoonStar,
    tone: "bg-violet-50 text-violet-700",
  },
  snack: {
    title: "加餐",
    hint: "小零食也要算进预算，才不会悄悄超标。",
    icon: Sparkles,
    tone: "bg-emerald-50 text-emerald-700",
  },
};

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
      return "建立规律";
  }
}

function statusCopy(remainingCalories: number, calorieDeficit: number) {
  if (remainingCalories > 700) {
    return "今天空间还比较充足，下一餐优先安排蛋白质和蔬菜。";
  }
  if (remainingCalories > 250) {
    return "今天节奏不错，接下来只要稳住分量就行。";
  }
  if (calorieDeficit < 0) {
    return "今天已经超出预算，下一餐建议收一收主食和油脂。";
  }
  return "今天差不多该收口了，后面优先高蛋白、低负担。";
}

function getWeeklyGoalKg(profile: UserProfile) {
  if (!profile.weight_delta_kg || profile.weight_delta_kg <= 0) {
    return 0.2;
  }
  switch (profile.goal_type) {
    case "fat_loss":
      return Math.min(0.8, Number((profile.weight_delta_kg / 10).toFixed(2)) || 0.4);
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

function formatMealNames(meal: MealLog) {
  const names = meal.items.map((item) => item.recognized_name).filter(Boolean);
  return names.length > 0 ? names.join("、") : "未命名餐食";
}

function EmptyCard({ text }: { text: string }) {
  return <div className="soft-panel rounded-[22px] px-4 py-4 text-sm leading-6 text-slate-500">{text}</div>;
}

function MacroProgress({
  label,
  value,
  target,
  tone,
}: {
  label: string;
  value: number;
  target: number;
  tone: string;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="rounded-[22px] bg-white/72 px-4 py-4">
      <div className="flex items-center justify-between text-[12px] text-slate-500">
        <span>{label}</span>
        <span>
          {Math.round(value)}/{Math.round(target)}g
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError("首页数据加载失败，请确认后端服务和数据库状态正常。");
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
        <div className="glass-card w-full max-w-sm rounded-[32px] px-6 py-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[linear-gradient(135deg,#7b6cff,#9adfd7)]" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">正在同步今天的健康状态</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">饮食、运动和目标数据正在加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !profile || !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-card w-full max-w-sm rounded-[32px] px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">NutriAgent</h1>
          <p className="mt-2 text-sm text-slate-500">首页暂时还没准备好。</p>
          <p className="mt-5 text-sm leading-6 text-rose-500">{error || "首页初始化失败。"}</p>
          <button
            onClick={() => void loadDashboard(selectedDate)}
            className="mt-6 rounded-full bg-[#1e1c2b] px-5 py-2.5 text-sm text-white"
          >
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
  const statusText = statusCopy(remainingCalories, calorieDeficit);
  const activeMealCount = meals.length;
  const weekLabel = format(selectedDate, "M月d日 EEEE", { locale: zhCN });

  return (
    <div className="relative px-4 pb-36 pt-5">
      <section className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Today Hub</div>
            <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-slate-950">首页</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-[linear-gradient(135deg,#7667ff,#9d84ff)] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(118,103,255,0.25)]">
              {coach.name}
            </div>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="glass-card flex h-11 w-11 items-center justify-center rounded-full text-slate-700"
              aria-label="进入 Agent"
            >
              <Bot className="h-5 w-5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/review")}
          className="mt-5 flex w-full items-center justify-between rounded-[26px] bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(244,241,255,0.96))] px-5 py-4 text-left shadow-[0_18px_40px_rgba(148,145,201,0.12)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ece9ff] text-[#6f63ff]">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">本周目标</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">预计减重 {weeklyGoalKg.toFixed(2)} kg</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {weekDays.map((day) => {
              const active = isSameDay(day, selectedDate);
              const today = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`min-w-[68px] rounded-[24px] px-3 py-3 text-center transition ${
                    active ? "glass-card bg-white/95 text-slate-950" : "bg-white/54 text-slate-500"
                  }`}
                >
                  <div className={`text-xs ${active ? "text-slate-400" : today ? "text-[#6f63ff]" : "text-slate-400"}`}>
                    {today ? "今天" : format(day, "EEE", { locale: zhCN })}
                  </div>
                  <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-lg font-semibold">
                    {format(day, "d")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="glass-card mt-6 rounded-[34px] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-[200px]">
            <div className="text-sm text-slate-400">{weekLabel}</div>
            <div className="mt-3 text-[18px] font-medium text-slate-500">今天还可摄入</div>
            <div className="mt-1 text-[42px] font-semibold tracking-tight text-[#2bcab6]">{remainingCalories}</div>
            <div className="text-lg font-medium text-slate-700">千卡</div>
          </div>

          <div className="soft-panel flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full">
            <div className="rounded-full bg-[linear-gradient(135deg,#7b6cff,#8c94ff)] p-4 text-white shadow-[0_18px_28px_rgba(123,108,255,0.28)]">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div className="mt-3 text-xs text-slate-400">已记录 {activeMealCount} 餐</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{Math.round(consumedCalories)} kcal</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-[#fbfaff] px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-2.5 w-2.5 rounded-full bg-[#3fd4c1]" />
              饮食摄入
            </div>
            <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{Math.round(consumedCalories)}</div>
            <div className="text-sm text-slate-400">目标 {calorieTarget} kcal</div>
          </div>
          <div className="rounded-[24px] bg-[#fbfaff] px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-2.5 w-2.5 rounded-full bg-[#7fa8ff]" />
              运动消耗
            </div>
            <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{Math.round(burnedCalories)}</div>
            <div className="text-sm text-slate-400">已记 {summary.exercise_count} 次</div>
          </div>
        </div>

        <div className="soft-panel mt-4 rounded-[26px] px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">今日营养进度</div>
            <div className="rounded-full bg-[#ece9ff] px-3 py-1 text-xs font-medium text-[#6f63ff]">缺口 {calorieDeficit} kcal</div>
          </div>
          <div className="mt-4 grid gap-3">
            <MacroProgress label="碳水" value={summary.total_carb_g || 0} target={profile.carb_target_g || 250} tone="bg-[#58d9c4]" />
            <MacroProgress label="蛋白质" value={summary.total_protein_g || 0} target={profile.protein_target_g || 100} tone="bg-[#7a90ff]" />
            <MacroProgress label="脂肪" value={summary.total_fat_g || 0} target={profile.fat_target_g || 70} tone="bg-[#ffb667]" />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="glass-card rounded-[30px] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ede9ff,#d9fff9)] text-[#6f63ff]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-400">今日建议</div>
              <div className="mt-1 text-base font-semibold text-slate-950">{goalLabel(profile.goal_type)}</div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="rounded-full bg-[#1e1c2b] px-4 py-2 text-xs font-medium text-white"
            >
              问 {coach.name}
            </button>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-600">{statusText}</p>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {(["breakfast", "lunch", "dinner", "snack"] as MealSectionKey[]).map((sectionKey) => {
          const config = mealMeta[sectionKey];
          const Icon = config.icon;
          const sectionMeals = groupedMeals[sectionKey];

          return (
            <div key={sectionKey} className="glass-card rounded-[30px] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${config.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[22px] font-semibold tracking-tight text-slate-950">{config.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{config.hint}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToMealRecorder(sectionKey, "text")}
                  className="rounded-full bg-[#f3f1ff] px-4 py-2 text-xs font-medium text-[#6f63ff]"
                >
                  记录
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {sectionMeals.length === 0 ? (
                  <EmptyCard text={`这餐还没有记录。补一条 ${config.title} 数据后，首页会立刻刷新今天的预算和建议。`} />
                ) : (
                  sectionMeals.slice(0, 2).map((meal) => (
                    <div key={meal.id} className="soft-panel rounded-[24px] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{formatMealNames(meal)}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {format(new Date(meal.created_at), "HH:mm")} · {Math.round(meal.total_calories_kcal || 0)} kcal
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">{meal.items.length} 项</div>
                      </div>
                      {meal.ai_summary && <p className="mt-3 text-sm leading-6 text-slate-600">{meal.ai_summary}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        <div className="glass-card rounded-[30px] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#ecfbff] text-[#46bcd6]">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[22px] font-semibold tracking-tight text-slate-950">运动</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">运动记录会直接影响今天的热量缺口和推荐结果。</p>
              </div>
            </div>
            <button
              type="button"
              onClick={goToExerciseRecorder}
              className="rounded-full bg-[#eefbff] px-4 py-2 text-xs font-medium text-[#42a8c9]"
            >
              添加
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {exercises.length === 0 ? (
              <EmptyCard text="今天还没有运动记录。补一条训练数据后，Agent 的建议会更贴合你当前状态。" />
            ) : (
              exercises.slice(0, 2).map((exercise) => (
                <div key={exercise.id} className="soft-panel rounded-[24px] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {exerciseTypeLabels[exercise.exercise_type] || exercise.exercise_type}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {exercise.duration_minutes} 分钟 · 消耗 {Math.round(exercise.calories_burned_kcal)} kcal
                      </div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">训练</div>
                  </div>
                  {exercise.ai_summary && <p className="mt-3 text-sm leading-6 text-slate-600">{exercise.ai_summary}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4 md:bottom-24">
        <div className="glass-card rounded-[30px] px-3 py-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-medium text-slate-900">快速记录</div>
              <div className="text-xs text-slate-500">一句话记餐，或直接让 Agent 帮你判断下一步。</div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="flex items-center gap-1 rounded-full bg-[#1e1c2b] px-3 py-1.5 text-xs text-white"
            >
              Agent
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-[24px] bg-white/70 px-3 py-3">
            <PencilLine className="h-4 w-4 text-slate-400" />
            <input
              value={quickInput}
              onChange={(event) => setQuickInput(event.target.value)}
              placeholder="例如：晚餐吃了鸡胸肉、南瓜和酸奶"
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => goToMealRecorder("dinner", "image")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f4ff] text-[#6f63ff]"
              aria-label="图片记录"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7b6cff,#9b7bff)] text-white"
              aria-label="进入 Agent"
            >
              <Bot className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
