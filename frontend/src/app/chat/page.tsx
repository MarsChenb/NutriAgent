"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Bot,
  ChevronRight,
  Compass,
  Flame,
  PanelTop,
  Salad,
  SendHorizonal,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type {
  AgentPlanStep,
  AgentTraceStep,
  ChatApiResponse,
  ChatMessage,
  DailySummary,
  ExerciseLog,
  MealLog,
  UserProfile,
} from "@/lib/types";

type UiChatMessage = ChatMessage & {
  mode?: string | null;
  plan?: AgentPlanStep[] | null;
  executionTrace?: AgentTraceStep[] | null;
  requiresClarification?: boolean;
  clarificationQuestion?: string | null;
  missingFields?: string[] | null;
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
    description: "直接查询食物的参考热量和三大营养素。",
    prompt: "帮我查一下香蕉的热量和三大营养素。",
  },
  {
    id: "recommend-meal",
    title: "推荐下一餐",
    description: "结合我今天的热量预算，推荐现在适合吃什么。",
    prompt: "结合我今天的热量预算，推荐一顿适合现在吃的减脂餐。",
  },
  {
    id: "post-workout",
    title: "训练后怎么吃",
    description: "围绕恢复和减脂平衡给出建议。",
    prompt: "我刚训练完，接下来怎么吃更适合恢复又不影响减脂？",
  },
  {
    id: "fixed-demo",
    title: "固定 Demo 场景",
    description: "展示记录餐食、分析预算和推荐加餐的完整 Agent 链路。",
    prompt: "我刚记录了晚餐，吃了180g鸡胸肉、100g米饭和一份生菜。请先分析今天还剩多少热量，再推荐一个适合减脂的加餐。",
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
      return "建立规律";
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

function modeCopy(mode?: string | null) {
  switch (mode) {
    case "planned":
      return "Planned Execution";
    case "clarification":
      return "Clarification Needed";
    default:
      return "Direct Answer";
  }
}

function modeTone(mode?: string | null) {
  switch (mode) {
    case "planned":
      return "bg-[#ece9ff] text-[#6f63ff]";
    case "clarification":
      return "bg-[#fff3ea] text-[#ff8b6a]";
    default:
      return "bg-[#e9fbf7] text-[#2bbba5]";
  }
}

function formatMealNames(meal: MealLog) {
  const names = meal.items.map((item) => item.recognized_name).filter(Boolean);
  return names.length > 0 ? names.join("、") : "未命名餐食";
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="soft-panel rounded-[22px] px-4 py-4 text-sm leading-6 text-slate-500">{text}</div>;
}

export default function ChatPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentMeals, setRecentMeals] = useState<MealLog[]>([]);
  const [recentExercises, setRecentExercises] = useState<ExerciseLog[]>([]);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const conversationIdRef = useRef(`agent-studio-${Date.now()}`);
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
            content: `${coach.greeting}\n\n我已经拿到你今天的预算和最近记录了。你当前目标是 ${goalLabel(profileRes.data.goal_type)}，今天大约还剩 ${remaining} kcal 可以安排。你可以直接提问，也可以点下面的任务卡让我开始执行。`,
            timestamp: new Date(),
            mode: "direct",
          },
        ]);
      } catch (error) {
        console.error(error);
        setMessages([
          {
            role: "assistant",
            content: "AI 私教初始化失败，请确认后端服务可用。",
            timestamp: new Date(),
            mode: "direct",
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

    const newUserMessage: UiChatMessage = {
      role: "user",
      content: userMsg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await api.post<ChatApiResponse>("/chat/", {
        message: userMsg,
        conversation_id: conversationIdRef.current,
      });

      const assistantMessage: UiChatMessage = {
        role: "assistant",
        content: res.data.response,
        timestamp: new Date(),
        mode: res.data.mode,
        plan: res.data.plan,
        executionTrace: res.data.execution_trace,
        requiresClarification: res.data.requires_clarification,
        clarificationQuestion: res.data.clarification_question,
        missingFields: res.data.missing_fields,
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
          mode: "direct",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const coach = getCoachPersona(profile?.coach_persona);
  const headerCards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "剩余热量", value: `${Math.round(summary.calorie_remaining_kcal || 0)} kcal`, tone: "bg-[#e9fbf7] text-[#2bbba5]" },
      { label: "今日缺口", value: `${Math.round(summary.calorie_deficit_kcal || 0)} kcal`, tone: "bg-[#1e1c2b] text-white" },
      { label: "训练消耗", value: `${Math.round(summary.total_exercise_calories_kcal || 0)} kcal`, tone: "bg-[#eef5ff] text-[#6a88ff]" },
    ];
  }, [summary]);

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card w-full rounded-[32px] px-6 py-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[linear-gradient(135deg,#7b6cff,#9adfd7)]" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">正在唤醒你的 Agent 私教</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">画像、预算和最近记录正在同步中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-36 pt-5">
      <section className={`rounded-[34px] bg-gradient-to-br ${coach.gradientClass} px-5 py-6 text-white shadow-[0_24px_60px_rgba(111,99,255,0.24)]`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-white/75">Agent Studio</div>
            <h1 className="mt-3 text-[30px] font-semibold tracking-tight">{coach.name} AI 私教</h1>
            <p className="mt-3 max-w-[260px] text-sm leading-7 text-white/88">
              {coach.tagline}。这不是普通聊天框，而是会拆任务、调工具、必要时追问你的工作台。
            </p>
          </div>
          <button type="button" onClick={() => router.push("/")} className="rounded-full bg-white/12 px-3 py-2 text-sm text-white/90">
            返回首页
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push("/review")} className="rounded-full bg-white/12 px-4 py-2 text-xs text-white/90">
            看周计划
          </button>
          <button
            type="button"
            onClick={() => router.push(`/onboarding?mode=edit&next=${encodeURIComponent("/chat")}`)}
            className="rounded-full bg-white/12 px-4 py-2 text-xs text-white/90"
          >
            调整建档
          </button>
        </div>
      </section>

      {headerCards.length > 0 && (
        <section className="mt-5 grid grid-cols-3 gap-3">
          {headerCards.map((item) => (
            <div key={item.label} className={`rounded-[24px] px-4 py-4 ${item.tone}`}>
              <div className="text-[11px] opacity-75">{item.label}</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{item.value}</div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-5 space-y-4">
        <div className="glass-card rounded-[30px] px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Quick Tasks</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">一键发起任务</h2>
            </div>
            <div className="rounded-full bg-[#f3f1ff] px-3 py-1 text-xs font-medium text-[#6f63ff]">任务型交互</div>
          </div>

          <div className="mt-5 space-y-3">
            {quickTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleSend(task.prompt)}
                className="soft-panel flex w-full items-center justify-between gap-4 rounded-[24px] px-4 py-4 text-left transition hover:bg-white"
              >
                <div>
                  <div className="text-base font-semibold text-slate-950">{task.title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">{task.description}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-[30px] px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Context</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">当前上下文</h2>
            </div>
            <div className={`rounded-full bg-white px-3 py-1 text-xs font-medium ${coach.accentClass}`}>{goalLabel(profile?.goal_type || null)}</div>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Salad className="h-4 w-4 text-[#2bbba5]" />
                最近餐食
              </div>
              <div className="space-y-3">
                {recentMeals.length === 0 ? (
                  <EmptyPanel text="今天还没有餐食记录。你可以直接描述刚刚吃了什么，我可以边记录边给建议。" />
                ) : (
                  recentMeals.map((meal) => (
                    <div key={meal.id} className="soft-panel rounded-[22px] px-4 py-4">
                      <div className="text-sm font-medium text-slate-900">{formatMealNames(meal)}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {mealTypeLabel(meal.meal_type)} · {Math.round(meal.total_calories_kcal || 0)} kcal
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Swords className="h-4 w-4 text-[#6a88ff]" />
                最近运动
              </div>
              <div className="space-y-3">
                {recentExercises.length === 0 ? (
                  <EmptyPanel text="今天还没有运动记录。没有训练上下文时，训练后饮食建议会先按常规恢复策略来回答。" />
                ) : (
                  recentExercises.map((exercise) => (
                    <div key={exercise.id} className="soft-panel rounded-[22px] px-4 py-4">
                      <div className="text-sm font-medium text-slate-900">{exerciseTypeLabel(exercise.exercise_type)}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {exercise.duration_minutes} 分钟 · {Math.round(exercise.calories_burned_kcal)} kcal
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card mt-5 rounded-[30px] px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Conversation</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">和 {coach.name} 一起继续执行</h2>
          </div>
          <div className="rounded-full bg-[#f4f3ff] px-3 py-1 text-xs text-slate-500">上下文已注入</div>
        </div>

        <div className="mt-5 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" ? (
                <div className="max-w-[92%] rounded-[28px] rounded-bl-[14px] bg-[#fbfaff] px-4 py-4 shadow-[0_12px_24px_rgba(149,145,201,0.08)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${coach.gradientClass} text-xs font-semibold text-white`}>
                        {coach.name.slice(0, 1)}
                      </div>
                      <div className="text-xs font-medium text-slate-500">{coach.name}</div>
                    </div>
                    <div className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${modeTone(msg.mode)}`}>{modeCopy(msg.mode)}</div>
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{msg.content}</div>

                  {msg.requiresClarification && (
                    <div className="mt-4 rounded-[20px] bg-[#fff3ea] px-3 py-3 text-xs leading-6 text-[#d96e49]">
                      {msg.clarificationQuestion || "继续补充一点信息，我才能把这步任务接着做下去。"}
                    </div>
                  )}

                  {msg.missingFields && msg.missingFields.length > 0 && (
                    <div className="mt-3 rounded-[20px] bg-[#fff8f3] px-3 py-3 text-xs leading-6 text-[#d96e49]">
                      当前缺少：{msg.missingFields.join("、")}
                    </div>
                  )}

                  {msg.plan && msg.plan.length > 0 && (
                    <details className="mt-4 rounded-[22px] bg-white/80 px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-900">
                        <PanelTop className="h-4 w-4 text-[#6f63ff]" />
                        查看 Agent 计划
                      </summary>
                      <div className="mt-3 space-y-2">
                        {msg.plan.map((step) => (
                          <div key={step.id} className="rounded-[18px] bg-[#f7f5ff] px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{step.tool}</div>
                            <div className="mt-1 text-sm text-slate-700">{step.purpose}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {msg.executionTrace && msg.executionTrace.length > 0 && (
                    <details className="mt-4 rounded-[22px] bg-white/80 px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-900">
                        <Compass className="h-4 w-4 text-[#6f63ff]" />
                        查看执行过程
                      </summary>
                      <div className="mt-3 space-y-2">
                        {msg.executionTrace.map((step) => (
                          <div key={step.step_id} className="rounded-[18px] bg-[#f7f5ff] px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{step.tool}</div>
                              <div
                                className={`rounded-full px-2 py-1 text-[10px] ${
                                  step.status === "completed" ? "bg-[#e9fbf7] text-[#2bbba5]" : "bg-[#fff1ef] text-[#ef6c5a]"
                                }`}
                              >
                                {step.status}
                              </div>
                            </div>
                            <div className="mt-1 text-sm text-slate-700">{step.summary}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="max-w-[80%] rounded-[28px] rounded-br-[14px] bg-[#1e1c2b] px-4 py-4 text-sm leading-7 text-white shadow-[0_14px_24px_rgba(30,28,43,0.18)]">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-[28px] rounded-bl-[14px] bg-[#fbfaff] px-4 py-4 shadow-[0_12px_24px_rgba(149,145,201,0.08)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${coach.gradientClass} text-xs font-semibold text-white`}>
                    {coach.name.slice(0, 1)}
                  </div>
                  <div className="text-xs font-medium text-slate-500">{coach.name} 正在执行</div>
                </div>
                <div className="flex gap-1">
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

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4 md:bottom-24">
        <div className="glass-card rounded-[30px] px-3 py-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-medium text-slate-900">继续发起任务</div>
              <div className="text-xs text-slate-500">可以直接提问，也可以描述一个复合任务让我拆解执行。</div>
            </div>
            <div className="rounded-full bg-[#f4f3ff] px-3 py-1.5 text-xs font-medium text-slate-500">{coach.name} 在线</div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 px-1">
            <button type="button" onClick={() => handleSend("帮我查一下鸡胸肉的热量。")} className="rounded-full bg-[#f7f5ff] px-3 py-2 text-xs text-slate-600">
              <Flame className="mr-1 inline h-3.5 w-3.5 text-[#ff8b6a]" />
              查热量
            </button>
            <button type="button" onClick={() => handleSend("帮我推荐一个低脂晚餐。")} className="rounded-full bg-[#f7f5ff] px-3 py-2 text-xs text-slate-600">
              <Target className="mr-1 inline h-3.5 w-3.5 text-[#6f63ff]" />
              推荐晚餐
            </button>
            <button
              type="button"
              onClick={() => handleSend("如果我今晚训练，训练后怎么吃更稳？")}
              className="rounded-full bg-[#f7f5ff] px-3 py-2 text-xs text-slate-600"
            >
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-[#2bbba5]" />
              训练后怎么吃
            </button>
          </div>

          <div className="flex gap-2 rounded-[24px] bg-white/72 px-3 py-3">
            <input
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="例如：今天还可以吃什么，或者描述一条复合任务"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSend()}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7b6cff,#9b7bff)] text-white disabled:opacity-40"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
