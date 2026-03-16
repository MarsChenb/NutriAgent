"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Dumbbell,
  Flame,
  HeartPulse,
  MoveRight,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const exerciseTypes = [
  { value: "walking", label: "步行", hint: "适合轻度活动日，把 NEAT 先做起来。" },
  { value: "running", label: "跑步", hint: "提高热量消耗，注意心率和恢复。" },
  { value: "cycling", label: "骑行", hint: "更友好的有氧方式，适合拉长时长。" },
  { value: "strength", label: "力量训练", hint: "减脂期也要保肌肉，别只做有氧。" },
  { value: "hiit", label: "HIIT", hint: "时长可以短一点，但强度会更高。" },
  { value: "yoga", label: "瑜伽拉伸", hint: "帮助恢复状态，也能改善身体感受。" },
  { value: "swimming", label: "游泳", hint: "全身参与感强，适合做交叉训练。" },
  { value: "other", label: "其他", hint: "按真实活动填写，先把记录补全最重要。" },
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

  const activeType = exerciseTypes.find((item) => item.value === exerciseType) ?? exerciseTypes[0];
  const estimateHint = useMemo(() => {
    if (durationMinutes <= 20) return "今天先把运动接上，重点是让习惯不断掉。";
    if (durationMinutes <= 45) return "这类时长比较适合作为日常减脂安排。";
    return "训练时长已经比较高了，结束后记得补水和恢复。";
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
    <div className="px-4 pb-36 pt-5">
      <section className="rounded-[34px] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(238,251,255,0.96))] px-5 py-6 shadow-[0_20px_40px_rgba(149,145,201,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(`/?date=${exerciseDate}`)}
            className="glass-card flex h-11 w-11 items-center justify-center rounded-full text-slate-700"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="rounded-full bg-[#eefbff] px-3 py-1.5 text-xs font-medium text-[#42a8c9]">{activeType.label}</div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Exercise Log</div>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-slate-950">补一条今天的训练</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">{activeType.hint}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-white/78 px-4 py-4">
            <div className="text-xs text-slate-400">运动日期</div>
            <input
              type="date"
              value={exerciseDate}
              onChange={(event) => setExerciseDate(event.target.value)}
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </div>
          <div className="rounded-[24px] bg-white/78 px-4 py-4">
            <div className="text-xs text-slate-400">当前类型</div>
            <div className="mt-2 flex h-[50px] items-center rounded-[18px] bg-[#f7fbff] px-4 text-sm font-medium text-slate-900">{activeType.label}</div>
          </div>
        </div>
      </section>

      <section className="mt-5 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {exerciseTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setExerciseType(item.value)}
              className={`rounded-[24px] px-5 py-3 text-sm font-medium transition ${
                exerciseType === item.value ? "bg-[#1e1c2b] text-white shadow-[0_14px_24px_rgba(30,28,43,0.18)]" : "glass-card text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card mt-5 rounded-[30px] px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="soft-panel rounded-[24px] px-4 py-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TimerReset className="h-3.5 w-3.5" />
              运动时长
            </div>
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value) || 0)}
              className="mt-3 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-2xl font-semibold text-slate-950 outline-none"
            />
            <div className="mt-2 text-xs text-slate-400">分钟</div>
          </div>

          <div className="soft-panel rounded-[24px] px-4 py-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Flame className="h-3.5 w-3.5" />
              估算消耗
            </div>
            <input
              type="number"
              min={1}
              value={caloriesBurned}
              onChange={(event) => setCaloriesBurned(Number(event.target.value) || 0)}
              className="mt-3 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-2xl font-semibold text-slate-950 outline-none"
            />
            <div className="mt-2 text-xs text-slate-400">kcal</div>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] bg-[#eefbff] px-4 py-4 text-sm leading-7 text-[#42a8c9]">
          {estimateHint}
        </div>

        <div className="mt-4 rounded-[26px] bg-[#fbfaff] px-4 py-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
            <Dumbbell className="h-4 w-4 text-[#6f63ff]" />
            训练备注
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="例如：晚饭后快走 40 分钟，配速比较稳；或者写今天训练的感受。"
            className="min-h-[130px] w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        {error && <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-600">{error}</div>}
      </section>

      <section className="mt-5 rounded-[28px] bg-white/62 px-5 py-5 text-sm leading-7 text-slate-500 shadow-[0_14px_28px_rgba(149,145,201,0.08)]">
        <div className="mb-3 flex items-center gap-2 text-slate-900">
          <Sparkles className="h-4 w-4 text-[#6f63ff]" />
          <span className="font-medium">记录建议</span>
        </div>
        运动记录不需要极其精确，关键是能稳定回流到热量缺口和 Agent 建议里。时长、类型和消耗量先填完整，之后再慢慢细化。
      </section>

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4 md:bottom-24">
        <div className="glass-card rounded-[30px] px-3 py-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-medium text-slate-900">保存这次训练</div>
              <div className="text-xs text-slate-500">保存后会回写首页缺口和当日建议。</div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="flex items-center gap-1 rounded-full bg-[#eefbff] px-3 py-1.5 text-xs font-medium text-[#42a8c9]"
            >
              问 Agent
              <MoveRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#7b6cff,#9b7bff)] px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <HeartPulse className="h-4 w-4" />
            {saving ? "保存中..." : "保存运动记录并返回首页"}
          </button>
        </div>
      </section>
    </div>
  );
}
