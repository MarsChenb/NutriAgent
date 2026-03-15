"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { ChatMessage, DailySummary, ExerciseLog, MealLog, UserProfile } from "@/lib/types";

type ChatApiResponse = {
  response: string;
  intent?: string | null;
  context_snapshot?: {
    calorie_remaining?: number;
    calorie_deficit?: number;
  } | null;
};

type QuickTask = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

const quickTasks: QuickTask[] = [
  {
    id: "lookup-food",
    title: "查食物热量",
    description: "查询食物参考热量和三大营养素",
    prompt: "帮我查香蕉的热量和三大营养素。",
  },
  {
    id: "recommend-meal",
    title: "推荐饮食",
    description: "根据我今天的预算推荐下一餐",
    prompt: "结合我今天的热量预算，推荐一顿适合现在吃的减脂餐。",
  },
  {
    id: "post-workout",
    title: "训练后怎么吃",
    description: "围绕恢复和减脂做建议",
    prompt: "我刚训练完，接下来怎么吃更适合恢复又不影响减脂？",
  },
  {
    id: "remaining-budget",
    title: "今天还能吃什么",
    description: "结合剩余热量给行动建议",
    prompt: "结合我今天的剩余热量，告诉我现在还能吃什么。",
  },
];

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
      return "当前目标";
  }
}

export default function ChatPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentMeals, setRecentMeals] = useState<MealLog[]>([]);
  const [recentExercises, setRecentExercises] = useState<ExerciseLog[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadContext() {
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const [profileRes, summaryRes, mealsRes, exercisesRes] = await Promise.all([
          api.get<UserProfile>("/users/me/profile"),
          api.get<DailySummary>("/meals/daily-summary", { params: { summary_date: today } }),
          api.get<MealLog[]>("/meals/", { params: { meal_date: today } }),
          api.get<ExerciseLog[]>("/exercises/", { params: { exercise_date: today } }),
        ]);

        if (!profileRes.data.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        setProfile(profileRes.data);
        setSummary(summaryRes.data);
        setRecentMeals(mealsRes.data.slice(0, 4));
        setRecentExercises(exercisesRes.data.slice(0, 3));

        const coach = getCoachPersona(profileRes.data.coach_persona);
        const remaining = Math.round(summaryRes.data.calorie_remaining_kcal || 0);
        setMessages([
          {
            role: "assistant",
            content: `${coach.greeting}\n\n我已经拿到你的画像、今天的热量预算和最近记录了。你当前目标是${goalLabel(profileRes.data.goal_type)}，今天大约还剩 ${remaining} kcal 可以安排。你可以直接问我，也可以点上面的快捷任务。`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error(error);
        setMessages([
          {
            role: "assistant",
            content: "AI 私教初始化失败，请确认后端服务可用。",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setBootstrapping(false);
      }
    }

    loadContext();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(preset?: string) {
    const userMsg = (preset ?? input).trim();
    if (!userMsg || loading) return;
    setInput("");

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMsg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await api.post<ChatApiResponse>("/chat/", { message: userMsg });
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (res.data.context_snapshot?.calorie_remaining != null && summary) {
        setSummary({
          ...summary,
          calorie_remaining_kcal: res.data.context_snapshot.calorie_remaining,
          calorie_deficit_kcal: res.data.context_snapshot.calorie_deficit ?? summary.calorie_deficit_kcal,
        });
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "AI 私教暂时不可用，请稍后再试。",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const coach = getCoachPersona(profile?.coach_persona);
  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "剩余热量", value: `${Math.round(summary.calorie_remaining_kcal || 0)} kcal` },
      { label: "今日缺口", value: `${Math.round(summary.calorie_deficit_kcal || 0)} kcal` },
      { label: "运动消耗", value: `${Math.round(summary.total_exercise_calories_kcal || 0)} kcal` },
    ];
  }, [summary]);

  if (bootstrapping) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">正在唤醒你的 AI 私教...</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_35%)]">
      <div className="border-b border-white/60 bg-white/80 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{coach.name} AI 私教</h1>
            <p className="text-sm text-slate-500">已注入用户画像、今日预算、最近餐食和运动记录</p>
          </div>
          <button onClick={() => router.push("/onboarding")} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
            编辑建档
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className={`rounded-[28px] bg-gradient-to-br ${coach.gradientClass} p-5 text-white shadow-sm`}>
          <div className="text-sm text-white/75">当前教练人格</div>
          <div className="mt-2 text-2xl font-semibold">{coach.style}</div>
          <div className="mt-2 max-w-[18rem] text-sm text-white/90">{coach.tagline}</div>
        </div>

        {summaryCards.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-900">快捷任务</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {quickTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleSend(task.prompt)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">{task.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-900">最近餐食</div>
            <div className="mt-3 space-y-3">
              {recentMeals.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">今天还没有餐食记录。</div>
              ) : (
                recentMeals.map((meal) => (
                  <div key={meal.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{meal.items.map((item) => item.recognized_name).filter(Boolean).join("、") || "未命名餐食"}</div>
                    <div className="mt-1 text-xs text-slate-500">{Math.round(meal.total_calories_kcal || 0)} kcal · {meal.meal_type}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-900">最近运动</div>
            <div className="mt-3 space-y-3">
              {recentExercises.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">今天还没有运动记录。</div>
              ) : (
                recentExercises.map((exercise) => (
                  <div key={exercise.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{exercise.exercise_type}</div>
                    <div className="mt-1 text-xs text-slate-500">{exercise.duration_minutes} 分钟 · {Math.round(exercise.calories_burned_kcal)} kcal</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm ${msg.role === "user" ? "rounded-br-md bg-slate-950 text-white" : "rounded-bl-md bg-white text-slate-800 shadow-sm"}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-16 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-white/70 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            placeholder={`问问 ${coach.name}，例如：今晚还能怎么吃？`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
