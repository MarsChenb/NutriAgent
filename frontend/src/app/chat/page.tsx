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
  emoji: string;
};

const quickTasks: QuickTask[] = [
  {
    id: "lookup-food",
    title: "查食物热量",
    description: "查询食物参考热量和三大营养素",
    prompt: "帮我查香蕉的热量和三大营养素。",
    emoji: "热",
  },
  {
    id: "recommend-meal",
    title: "推荐饮食",
    description: "根据我今天的预算推荐下一餐",
    prompt: "结合我今天的热量预算，推荐一顿适合现在吃的减脂餐。",
    emoji: "荐",
  },
  {
    id: "post-workout",
    title: "训练后怎么吃",
    description: "围绕恢复和减脂做建议",
    prompt: "我刚训练完，接下来怎么吃更适合恢复又不影响减脂？",
    emoji: "练",
  },
  {
    id: "remaining-budget",
    title: "今天还能吃什么",
    description: "结合剩余热量给行动建议",
    prompt: "结合我今天的剩余热量，告诉我现在还能吃什么。",
    emoji: "余",
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

function mealTypeLabel(type: string | null) {
  switch (type) {
    case "breakfast":
      return "早餐";
    case "lunch":
      return "午餐";
    case "dinner":
      return "晚餐";
    case "snack":
      return "加餐";
    default:
      return type || "未分类";
  }
}

function exerciseTypeLabel(type: string) {
  switch (type) {
    case "walking":
      return "步行";
    case "running":
      return "跑步";
    case "cycling":
      return "骑行";
    case "strength":
      return "力量训练";
    case "hiit":
      return "HIIT";
    case "yoga":
      return "瑜伽拉伸";
    case "swimming":
      return "游泳";
    default:
      return type;
  }
}

function EmptyInfo({ text }: { text: string }) {
  return <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-500">{text}</div>;
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
      { label: "剩余热量", value: `${Math.round(summary.calorie_remaining_kcal || 0)} kcal`, tone: "bg-emerald-50 text-emerald-950" },
      { label: "今日缺口", value: `${Math.round(summary.calorie_deficit_kcal || 0)} kcal`, tone: "bg-slate-950 text-white" },
      { label: "运动消耗", value: `${Math.round(summary.total_exercise_calories_kcal || 0)} kcal`, tone: "bg-sky-50 text-sky-950" },
    ];
  }, [summary]);

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[32px] border border-white/70 bg-white/92 p-7 text-center shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-slate-900" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">正在唤醒你的 AI 私教</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">教练正在读取你的画像、今日预算和最近记录...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 pb-36 pt-4 md:px-6 md:pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_70%)]" />

      <section className={`relative overflow-hidden rounded-[34px] bg-gradient-to-br ${coach.gradientClass} p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] md:p-7`}>
        <div className="absolute -right-8 top-8 h-32 w-32 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-24 w-40 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs text-white/80 backdrop-blur">
              <span className="text-[10px] tracking-[0.28em]">AI COACH STUDIO</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">{coach.mbti}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/18 text-lg font-semibold backdrop-blur">{coach.name.slice(0, 1)}</div>
              <div>
                <div className="text-sm text-white/80">当前私教</div>
                <h1 className="text-[30px] font-semibold tracking-tight">{coach.name} AI 私教</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/88">{coach.tagline}。这页不是空白聊天框，而是把你的目标、预算和最近执行情况都带进来的对话式工具台。</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[320px]">
            <div className="rounded-[24px] bg-white/14 p-4 backdrop-blur">
              <div className="text-xs text-white/70">目标焦点</div>
              <div className="mt-2 text-2xl font-semibold">{goalLabel(profile?.goal_type || null)}</div>
              <div className="mt-2 text-xs text-white/75">画像和当日状态已注入</div>
            </div>
            <div className="rounded-[24px] bg-white/14 p-4 backdrop-blur">
              <div className="text-xs text-white/70">今日对话建议</div>
              <div className="mt-2 text-2xl font-semibold">先问一件事</div>
              <div className="mt-2 text-xs text-white/75">例如下一餐、训练后恢复、热量判断</div>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <button onClick={() => router.push("/review")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            看周复盘
          </button>
          <button onClick={() => router.push("/")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            回首页
          </button>
          <button onClick={() => router.push("/onboarding")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            调整建档
          </button>
        </div>
      </section>

      {summaryCards.length > 0 && (
        <section className="mt-5 grid gap-4 md:grid-cols-3">
          {summaryCards.map((item) => (
            <div key={item.label} className={`rounded-[28px] border border-white/70 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur ${item.tone}`}>
              <div className={`text-xs ${item.tone.includes("text-white") ? "text-white/65" : "text-slate-500"}`}>{item.label}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Quick Tasks</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">高频任务入口</h2>
            </div>
            <button onClick={() => router.push("/review")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
              查看周复盘
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleSend(task.prompt)}
                className="group rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_16px_28px_rgba(148,163,184,0.16)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-slate-950 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]">
                    {task.emoji}
                  </div>
                  <div className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 group-hover:border-slate-300">点击发起</div>
                </div>
                <div className="mt-4 text-base font-semibold text-slate-950">{task.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{task.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Context</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">最近执行情报</h2>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-medium ${coach.accentClass} bg-slate-50`}>{coach.style}</div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div>
                <div className="mb-3 text-sm font-medium text-slate-900">最近餐食</div>
                <div className="space-y-3">
                  {recentMeals.length === 0 ? (
                    <EmptyInfo text="今天还没有餐食记录，问我时我会按你的画像和目标给建议。" />
                  ) : (
                    recentMeals.map((meal) => (
                      <div key={meal.id} className="rounded-[22px] bg-slate-50/90 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{meal.items.map((item) => item.recognized_name).filter(Boolean).join("、") || "未命名餐食"}</div>
                            <div className="mt-1 text-xs text-slate-500">{mealTypeLabel(meal.meal_type)} · {Math.round(meal.total_calories_kcal || 0)} kcal</div>
                          </div>
                          <div className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">{mealTypeLabel(meal.meal_type)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-slate-900">最近运动</div>
                <div className="space-y-3">
                  {recentExercises.length === 0 ? (
                    <EmptyInfo text="今天还没有运动记录，训练后饮食建议会优先按常规恢复策略回答。" />
                  ) : (
                    recentExercises.map((exercise) => (
                      <div key={exercise.id} className="rounded-[22px] bg-slate-50/90 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{exerciseTypeLabel(exercise.exercise_type)}</div>
                            <div className="mt-1 text-xs text-slate-500">{exercise.duration_minutes} 分钟 · {Math.round(exercise.calories_burned_kcal)} kcal</div>
                          </div>
                          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">训练</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Conversation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">和 {coach.name} 一起判断下一步</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">上下文已自动注入</div>
        </div>

        <div className="mt-5 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" ? (
                <div className="max-w-[88%] rounded-[28px] rounded-bl-[12px] bg-slate-50/95 px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.14)] md:max-w-[78%]">
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${coach.gradientClass} text-xs font-semibold text-white`}>
                      {coach.name.slice(0, 1)}
                    </div>
                    <div className="text-xs font-medium text-slate-500">{coach.name}</div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{msg.content}</div>
                </div>
              ) : (
                <div className="max-w-[82%] rounded-[28px] rounded-br-[12px] bg-slate-950 px-4 py-4 text-sm leading-7 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] md:max-w-[72%]">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-[28px] rounded-bl-[12px] bg-slate-50/95 px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.14)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${coach.gradientClass} text-xs font-semibold text-white`}>
                    {coach.name.slice(0, 1)}
                  </div>
                  <div className="text-xs font-medium text-slate-500">{coach.name} 正在思考</div>
                </div>
                <div className="flex space-x-1 px-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </section>

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-4 md:bottom-28">
        <div className="rounded-[30px] border border-white/80 bg-white/92 p-3 shadow-[0_24px_40px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-medium text-slate-900">继续对话</div>
              <div className="text-xs text-slate-500">直接描述你的问题，或先点上方任务卡</div>
            </div>
            <div className={`rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium ${coach.accentClass}`}>{coach.name} 在线</div>
          </div>
          <div className="flex gap-2 rounded-[22px] bg-slate-50 px-3 py-3">
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder={`问问 ${coach.name}，例如：今晚还能怎么吃？`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSend()}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] disabled:opacity-40"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
