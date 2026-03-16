"use client";

import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  Flame,
  HeartPulse,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { UserProfile, WeeklyReview, WeeklyReviewDay } from "@/lib/types";

function statusTone(status: string) {
  if (status === "达标") return "bg-[#e9fbf7] text-[#2bbba5]";
  if (status === "未达标") return "bg-[#fff3ea] text-[#ff8b6a]";
  return "bg-slate-100 text-slate-500";
}

function statusCopy(status: string) {
  if (status === "达标") return "这一天控制得比较稳，继续保持就好。";
  if (status === "未达标") return "今天有波动，但重点是看清问题出在哪。";
  return "数据还不完整，先把记录补齐再判断表现。";
}

function dayLabel(item: WeeklyReviewDay) {
  return format(parseISO(item.summary_date), "M月d日 EEEE", { locale: zhCN });
}

export default function ReviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReview() {
      try {
        const [profileRes, reviewRes] = await Promise.all([
          api.get<UserProfile>("/users/me/profile"),
          api.get<WeeklyReview>("/health/weekly-review"),
        ]);
        if (!profileRes.data.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }
        setProfile(profileRes.data);
        setReview(reviewRes.data);
      } catch (loadError) {
        console.error(loadError);
        setError("周计划加载失败，请确认后端服务和数据库状态正常。");
      } finally {
        setLoading(false);
      }
    }

    loadReview();
  }, [router]);

  const totals = useMemo(() => {
    if (!review) return null;
    return review.daily_items.reduce(
      (acc, item) => {
        acc.intake += item.total_calories_kcal;
        acc.exercise += item.total_exercise_calories_kcal;
        acc.deficit += item.calorie_deficit_kcal;
        if (item.status === "达标") acc.goodDays += 1;
        if (item.status === "数据不足") acc.missingDays += 1;
        return acc;
      },
      { intake: 0, exercise: 0, deficit: 0, goodDays: 0, missingDays: 0 },
    );
  }, [review]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card w-full rounded-[32px] px-6 py-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[linear-gradient(135deg,#7b6cff,#9adfd7)]" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">正在生成你的周计划</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">最近 7 天的饮食、运动和体重数据正在整理中...</p>
        </div>
      </div>
    );
  }

  if (error || !profile || !review || !totals) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-card w-full rounded-[32px] px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <HeartPulse className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">周计划</h1>
          <p className="mt-2 text-sm text-slate-500">这页暂时还没准备好。</p>
          <p className="mt-5 text-sm leading-6 text-rose-500">{error || "周计划初始化失败。"}</p>
          <button onClick={() => router.push("/")} className="mt-6 rounded-full bg-[#1e1c2b] px-5 py-2.5 text-sm text-white">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const coach = getCoachPersona(profile.coach_persona);
  const weightChangeLabel = review.weight_change_kg != null ? `${review.weight_change_kg > 0 ? "+" : ""}${review.weight_change_kg} kg` : "--";
  const avgDeficit = Math.round(totals.deficit / Math.max(review.daily_items.length, 1));

  return (
    <div className="px-4 pb-32 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="glass-card flex h-11 w-11 items-center justify-center rounded-full text-slate-700"
          aria-label="返回首页"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="rounded-full bg-[#1e1c2b] px-4 py-2 text-sm text-white"
        >
          问 {coach.name}
        </button>
      </div>

      <section className={`rounded-[34px] bg-gradient-to-br ${coach.gradientClass} px-5 py-6 text-white shadow-[0_24px_60px_rgba(111,99,255,0.22)]`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-white/75">Weekly Plan</div>
            <h1 className="mt-3 text-[30px] font-semibold tracking-tight">我的 7 日计划</h1>
          </div>
          <div className="rounded-full border border-white/30 px-3 py-1 text-xs tracking-[0.18em]">7 DAYS</div>
        </div>
        <p className="mt-4 text-sm leading-7 text-white/88">
          {format(parseISO(review.week_start), "M月d日", { locale: zhCN })} - {format(parseISO(review.week_end), "M月d日", { locale: zhCN })}
          。这页用来把过去 7 天的吃、动、体重变化收束成一个可以复盘的结果页。
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-white/14 px-4 py-4 backdrop-blur">
            <div className="text-xs text-white/70">达标天数</div>
            <div className="mt-2 text-3xl font-semibold">{totals.goodDays}</div>
            <div className="mt-2 text-xs text-white/75">还剩 {7 - totals.goodDays} 天需要继续优化</div>
          </div>
          <div className="rounded-[24px] bg-white/14 px-4 py-4 backdrop-blur">
            <div className="text-xs text-white/70">体重变化</div>
            <div className="mt-2 text-3xl font-semibold">{weightChangeLabel}</div>
            <div className="mt-2 text-xs text-white/75">基于最近 7 天体重记录</div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[28px] bg-[#1e1c2b] px-4 py-5 text-white shadow-[0_18px_36px_rgba(30,28,43,0.14)]">
          <div className="text-xs text-white/65">日均热量缺口</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{avgDeficit}</div>
          <div className="mt-2 text-xs text-white/65">kcal / 天</div>
        </div>
        <div className="rounded-[28px] bg-[#e9fbf7] px-4 py-5 text-[#2bbba5]">
          <div className="text-xs opacity-75">本周训练消耗</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(totals.exercise)}</div>
          <div className="mt-2 text-xs opacity-75">kcal</div>
        </div>
        <div className="rounded-[28px] bg-[#eef5ff] px-4 py-5 text-[#6a88ff]">
          <div className="text-xs opacity-75">本周摄入总量</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(totals.intake)}</div>
          <div className="mt-2 text-xs opacity-75">kcal</div>
        </div>
        <div className="rounded-[28px] bg-white px-4 py-5 text-slate-900 shadow-[0_18px_36px_rgba(149,145,201,0.08)]">
          <div className="text-xs text-slate-400">数据不足天数</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{totals.missingDays}</div>
          <div className="mt-2 text-xs text-slate-400">先保证记录完整性</div>
        </div>
      </section>

      <section className="glass-card mt-5 rounded-[30px] px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">AI Summary</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">本周总结</h2>
          </div>
          <div className={`rounded-full bg-white px-3 py-1 text-xs font-medium ${coach.accentClass}`}>{coach.name} 生成</div>
        </div>
        <div className="mt-5 rounded-[26px] bg-[#fbfaff] px-5 py-5 text-sm leading-8 text-slate-700">
          {review.weekly_summary_ai}
        </div>

        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="mt-4 flex items-center gap-2 rounded-full bg-[#f3f1ff] px-4 py-2 text-sm font-medium text-[#6f63ff]"
        >
          继续问 {coach.name}
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#6f63ff]" />
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">每日热量缺口</h2>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {review.daily_items.map((item) => (
            <div key={item.summary_date} className="min-w-[74px] rounded-[24px] bg-white/72 px-3 py-3 text-center shadow-[0_14px_28px_rgba(149,145,201,0.08)]">
              <div className={`text-xs ${parseISO(item.summary_date).toDateString() === new Date().toDateString() ? "text-[#6f63ff]" : "text-slate-400"}`}>
                {format(parseISO(item.summary_date), "M.d")}
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-950">{Math.round(item.calorie_deficit_kcal || 0)}</div>
              <div className="mt-2 flex justify-center">
                <span className={`rounded-full px-2 py-1 text-[10px] ${statusTone(item.status)}`}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 space-y-4">
        {review.daily_items.map((item: WeeklyReviewDay) => (
          <div key={item.summary_date} className="glass-card rounded-[30px] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1e1c2b] text-sm font-semibold text-white">
                  {format(parseISO(item.summary_date), "d")}
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-950">{dayLabel(item)}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-500">{statusCopy(item.status)}</div>
                </div>
              </div>
              <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{item.status}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="soft-panel rounded-[20px] px-3 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Flame className="h-3.5 w-3.5" />
                  饮食摄入
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{Math.round(item.total_calories_kcal)} kcal</div>
              </div>
              <div className="soft-panel rounded-[20px] px-3 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  运动消耗
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{Math.round(item.total_exercise_calories_kcal)} kcal</div>
              </div>
              <div className="soft-panel rounded-[20px] px-3 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Target className="h-3.5 w-3.5" />
                  热量缺口
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{Math.round(item.calorie_deficit_kcal)} kcal</div>
              </div>
              <div className="soft-panel rounded-[20px] px-3 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <HeartPulse className="h-3.5 w-3.5" />
                  体重
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{item.weight_kg != null ? `${item.weight_kg} kg` : "--"}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4 md:bottom-24">
        <div className="glass-card flex items-center justify-between rounded-[30px] px-4 py-4">
          <div>
            <div className="text-sm font-medium text-slate-900">继续执行这周计划</div>
            <div className="text-xs text-slate-500">把复盘结果直接接到 Agent 对话里。</div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/chat")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7b6cff,#9b7bff)] text-white"
            aria-label="进入 Agent"
          >
            <Bot className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
