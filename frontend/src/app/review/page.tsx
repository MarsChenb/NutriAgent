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
        return acc;
      },
      { intake: 0, exercise: 0, deficit: 0 },
    );
  }, [review]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">正在生成本周复盘...</div>;
  }

  if (error || !profile || !review || !totals) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full rounded-[28px] border border-white/70 bg-white/90 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">周度复盘</h1>
          <p className="mt-5 text-sm text-rose-500">{error || "周度复盘初始化失败。"}</p>
          <button onClick={() => router.push("/")} className="mt-6 rounded-full bg-slate-950 px-5 py-2 text-sm text-white">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const coach = getCoachPersona(profile.coach_persona);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f9ff_0%,#ffffff_42%)] px-4 pb-16 pt-4">
      <section className={`rounded-[30px] bg-gradient-to-br ${coach.gradientClass} p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)]`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">周度复盘</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">最近 7 天执行报告</h1>
            <p className="mt-2 text-sm text-white/90">
              {format(parseISO(review.week_start), "M月d日", { locale: zhCN })} - {format(parseISO(review.week_end), "M月d日", { locale: zhCN })}
            </p>
          </div>
          <button onClick={() => router.push("/")} className="rounded-full border border-white/35 px-3 py-1 text-xs text-white/90">
            返回首页
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="text-sm text-slate-500">AI 周总结</div>
        <div className="mt-3 whitespace-pre-wrap rounded-3xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
          {review.weekly_summary_ai}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <div className="text-xs text-slate-500">7 天饮食摄入</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.intake)} kcal</div>
        </div>
        <div className="rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <div className="text-xs text-slate-500">7 天运动消耗</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.exercise)} kcal</div>
        </div>
        <div className="rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <div className="text-xs text-slate-500">7 天热量缺口</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.deficit)} kcal</div>
        </div>
        <div className="rounded-[24px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <div className="text-xs text-slate-500">体重变化</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{review.weight_change_kg != null ? `${review.weight_change_kg > 0 ? "+" : ""}${review.weight_change_kg} kg` : "--"}</div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="text-sm font-medium text-slate-900">每日执行情况</div>
        <div className="mt-4 space-y-3">
          {review.daily_items.map((item: WeeklyReviewDay) => (
            <div key={item.summary_date} className="rounded-3xl bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{format(parseISO(item.summary_date), "M月d日 EEEE", { locale: zhCN })}</div>
                  <div className="mt-1 text-xs text-slate-500">摄入 {Math.round(item.total_calories_kcal)} kcal · 运动 {Math.round(item.total_exercise_calories_kcal)} kcal · 缺口 {Math.round(item.calorie_deficit_kcal)} kcal</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{item.status}</div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>体重</span>
                <span>{item.weight_kg != null ? `${item.weight_kg} kg` : "--"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
