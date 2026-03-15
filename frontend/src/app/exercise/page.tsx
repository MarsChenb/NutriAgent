"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const exerciseTypes = [
  { value: "walking", label: "步行" },
  { value: "running", label: "跑步" },
  { value: "cycling", label: "骑行" },
  { value: "strength", label: "力量训练" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga", label: "瑜伽拉伸" },
  { value: "swimming", label: "游泳" },
  { value: "other", label: "其他运动" },
];

function readParams() {
  if (typeof window === "undefined") {
    return {
      date: format(new Date(), "yyyy-MM-dd"),
      prefill: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    date: params.get("date") || format(new Date(), "yyyy-MM-dd"),
    prefill: params.get("prefill") || "",
  };
}

export default function ExercisePage() {
  const router = useRouter();
  const initialParams = readParams();

  const [exerciseType, setExerciseType] = useState("walking");
  const [exerciseDate, setExerciseDate] = useState(initialParams.date);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [caloriesBurned, setCaloriesBurned] = useState(180);
  const [notes, setNotes] = useState(initialParams.prefill);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = readParams();
    setExerciseDate(params.date);
    setNotes(params.prefill);
  }, []);

  const estimateHint = useMemo(() => {
    if (durationMinutes <= 20) return "短时活动，重在建立习惯。";
    if (durationMinutes <= 45) return "中等时长，适合作为日常减脂安排。";
    return "时长较长，注意补水和恢复。";
  }, [durationMinutes]);

  async function handleSave() {
    if (!exerciseType || durationMinutes <= 0 || caloriesBurned <= 0) {
      setError("请填写完整的运动类型、时长和消耗热量。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post("/exercises/", {
        exercise_type: exerciseType,
        exercise_date: exerciseDate,
        duration_minutes: durationMinutes,
        calories_burned_kcal: caloriesBurned,
        notes: notes || null,
      });
      router.push(`/?date=${exerciseDate}`);
    } catch (saveError) {
      console.error(saveError);
      setError("保存运动记录失败，请确认后端服务可用。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf8_0%,#ffffff_38%)] p-4 pb-20">
      <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">运动记录</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">手动补一条训练</h1>
            <p className="mt-2 text-sm text-slate-500">记录日期：{exerciseDate}</p>
          </div>
          <button onClick={() => router.push(`/?date=${exerciseDate}`)} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
            返回首页
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <label className="text-xs text-slate-500">运动日期</label>
            <input
              type="date"
              value={exerciseDate}
              onChange={(event) => setExerciseDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <label className="text-xs text-slate-500">运动类型</label>
            <select
              value={exerciseType}
              onChange={(event) => setExerciseType(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              {exerciseTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <label className="text-xs text-slate-500">时长（分钟）</label>
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value) || 0)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <label className="text-xs text-slate-500">估算消耗（kcal）</label>
            <input
              type="number"
              min={1}
              value={caloriesBurned}
              onChange={(event) => setCaloriesBurned(Number(event.target.value) || 0)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {estimateHint}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <label className="text-xs text-slate-500">备注</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="例如：晚饭后快走，配速稳定；或写下今天训练感受"
            className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>

        {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存运动记录并生成点评"}
          </button>
        </div>
      </div>
    </div>
  );
}
