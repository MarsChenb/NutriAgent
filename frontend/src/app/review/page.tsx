"use client";

import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getCoachPersona } from "@/lib/coach-personas";
import type { UserProfile, WeeklyReview, WeeklyReviewDay } from "@/lib/types";

function statusTone(status: string) {
  if (status === "达标") return "bg-emerald-100 text-emerald-700";
  if (status === "未达标") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function statusCopy(status: string) {
  if (status === "达标") return "这一天控制得比较稳，继续保持。";
  if (status === "未达标") return "有偏差，但仍然值得看清原因。";
  return "数据不完整，先把记录补起来。";
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
        setError("周度复盘加载失败，请确认后端服务可用。");
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
        <div className="w-full max-w-sm rounded-[32px] border border-white/70 bg-white/92 p-7 text-center shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-slate-900" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">正在生成周度复盘</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">系统正在整理 7 天的饮食、运动和体重变化...</p>
        </div>
      </div>
    );
  }

  if (error || !profile || !review || !totals) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[32px] border border-white/70 bg-white/92 p-7 text-center shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl">!</div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">周度复盘</h1>
          <p className="mt-2 text-sm text-slate-500">当前页面没有准备好</p>
          <p className="mt-5 text-sm leading-6 text-rose-500">{error || "周度复盘初始化失败。"}</p>
          <button onClick={() => router.push("/")} className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-sm text-white">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const coach = getCoachPersona(profile.coach_persona);
  const weightChangeLabel = review.weight_change_kg != null ? `${review.weight_change_kg > 0 ? "+" : ""}${review.weight_change_kg} kg` : "--";

  return (
    <div className="relative min-h-screen px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.74),transparent_70%)]" />

      <section className={`relative overflow-hidden rounded-[34px] bg-gradient-to-br ${coach.gradientClass} p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] md:p-7`}>
        <div className="absolute -right-8 top-8 h-32 w-32 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-24 w-40 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs text-white/80 backdrop-blur">
              <span className="text-[10px] tracking-[0.28em]">WEEKLY REVIEW</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">7 DAYS</span>
            </div>
            <h1 className="mt-4 text-[32px] font-semibold tracking-tight">最近 7 天执行报告</h1>
            <p className="mt-3 text-sm leading-7 text-white/88">
              {format(parseISO(review.week_start), "M月d日", { locale: zhCN })} - {format(parseISO(review.week_end), "M月d日", { locale: zhCN })}。
              这页用来把每天的吃、动、体重变化和执行状态收束成一份能复盘的结果页。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[320px]">
            <div className="rounded-[24px] bg-white/14 p-4 backdrop-blur">
              <div className="text-xs text-white/70">达标天数</div>
              <div className="mt-2 text-3xl font-semibold">{totals.goodDays}</div>
              <div className="mt-2 text-xs text-white/75">还有 {7 - totals.goodDays} 天需要继续复盘</div>
            </div>
            <div className="rounded-[24px] bg-white/14 p-4 backdrop-blur">
              <div className="text-xs text-white/70">体重变化</div>
              <div className="mt-2 text-3xl font-semibold">{weightChangeLabel}</div>
              <div className="mt-2 text-xs text-white/75">基于最近 7 天体重记录</div>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <button onClick={() => router.push("/")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            回首页
          </button>
          <button onClick={() => router.push("/chat")} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur">
            问问 {coach.name}
          </button>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AI Summary</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">本周总结</h2>
            </div>
            <div className={`rounded-full bg-slate-50 px-3 py-1 text-xs font-medium ${coach.accentClass}`}>{coach.name} 生成</div>
          </div>
          <div className="mt-5 rounded-[26px] bg-slate-50/90 px-5 py-5 text-sm leading-8 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            {review.weekly_summary_ai}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <div className="rounded-[28px] border border-white/70 bg-slate-950 p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
            <div className="text-xs text-white/65">7 天热量缺口</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(totals.deficit)} kcal</div>
            <div className="mt-2 text-xs text-white/65">用于看整体趋势，不要只看某一天。</div>
          </div>
          <div className="rounded-[28px] border border-white/70 bg-emerald-50 p-5 text-emerald-950 shadow-[0_16px_40px_rgba(148,163,184,0.14)]">
            <div className="text-xs text-emerald-700/70">7 天饮食摄入</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(totals.intake)} kcal</div>
            <div className="mt-2 text-xs text-emerald-700/70">记录越完整，复盘越可信。</div>
          </div>
          <div className="rounded-[28px] border border-white/70 bg-sky-50 p-5 text-sky-950 shadow-[0_16px_40px_rgba(148,163,184,0.14)]">
            <div className="text-xs text-sky-700/70">7 天运动消耗</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(totals.exercise)} kcal</div>
            <div className="mt-2 text-xs text-sky-700/70">训练记录会直接影响缺口判断。</div>
          </div>
          <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 text-slate-950 shadow-[0_16px_40px_rgba(148,163,184,0.14)]">
            <div className="text-xs text-slate-500">数据不足天数</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{totals.missingDays} 天</div>
            <div className="mt-2 text-xs text-slate-500">先把记录做完整，再谈更细的优化。</div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Timeline</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">每日执行时间轴</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">达标 / 未达标 / 数据不足</div>
        </div>

        <div className="mt-6 space-y-4">
          {review.daily_items.map((item: WeeklyReviewDay) => (
            <div key={item.summary_date} className="relative rounded-[28px] bg-slate-50/90 p-5">
              <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="relative z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]">
                    {format(parseISO(item.summary_date), "d")}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-950">{format(parseISO(item.summary_date), "M月d日 EEEE", { locale: zhCN })}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-500">{statusCopy(item.status)}</div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[20px] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                        <div className="text-xs text-slate-400">饮食摄入</div>
                        <div className="mt-1 font-semibold text-slate-950">{Math.round(item.total_calories_kcal)} kcal</div>
                      </div>
                      <div className="rounded-[20px] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                        <div className="text-xs text-slate-400">运动消耗</div>
                        <div className="mt-1 font-semibold text-slate-950">{Math.round(item.total_exercise_calories_kcal)} kcal</div>
                      </div>
                      <div className="rounded-[20px] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                        <div className="text-xs text-slate-400">热量缺口</div>
                        <div className="mt-1 font-semibold text-slate-950">{Math.round(item.calorie_deficit_kcal)} kcal</div>
                      </div>
                      <div className="rounded-[20px] bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">
                        <div className="text-xs text-slate-400">体重</div>
                        <div className="mt-1 font-semibold text-slate-950">{item.weight_kg != null ? `${item.weight_kg} kg` : "--"}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{item.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
