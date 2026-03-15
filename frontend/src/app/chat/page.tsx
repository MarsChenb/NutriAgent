"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { ChatMessage, UserProfile } from "@/lib/types";

export default function ChatPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get<UserProfile>("/users/me/profile");
        if (!res.data.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }
        setProfile(res.data);
        const coach = getCoachPersona(res.data.coach_persona);
        setMessages([
          {
            role: "assistant",
            content: `你好，我是 ${coach.name}。我已经读取了你的建档信息，可以围绕 ${goalLabel(res.data.goal_type)} 帮你继续细化执行。\n\n你可以直接问我：\n- 今天还能吃什么\n- 推荐一顿减脂晚餐\n- 训练后怎么补蛋白\n- 这个食物大概多少热量`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error(error);
        setMessages([
          {
            role: "assistant",
            content: "初始化 AI 私教失败，请确认后端服务可用。",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setBootstrapping(false);
      }
    }

    loadProfile();
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
      const res = await api.post("/chat/", { message: userMsg });
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
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

  if (bootstrapping) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">正在唤醒你的 AI 私教...</div>;
  }

  const coach = getCoachPersona(profile?.coach_persona);
  const quickActions = [
    "今天还能吃什么",
    "推荐一顿减脂晚餐",
    "训练后怎么补蛋白",
    "查一下香蕉的热量",
  ];

  return (
    <div className="flex h-screen flex-col bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_35%)]">
      <div className="border-b border-white/60 bg-white/80 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{coach.name} AI 私教</h1>
            <p className="text-sm text-slate-500">已读取你的建档信息，可继续做饮食和减脂决策</p>
          </div>
          <button onClick={() => router.push("/onboarding")} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">编辑建档</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className={`mb-4 rounded-[28px] bg-gradient-to-br ${coach.gradientClass} p-5 text-white shadow-sm`}>
          <div className="text-sm text-white/75">当前教练风格</div>
          <div className="mt-2 text-2xl font-semibold">{coach.style}</div>
          <div className="mt-2 max-w-[18rem] text-sm text-white/90">{coach.tagline}</div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleSend(action)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {action}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === "user" ? "rounded-br-md bg-slate-950 text-white" : "rounded-bl-md bg-white text-slate-800 shadow-sm"}`}>
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
            placeholder={`问问 ${coach.name}，例如：晚餐该怎么吃？`}
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
