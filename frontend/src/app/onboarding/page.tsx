"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { coachPersonas, getCoachPersona } from "@/lib/coach-personas";
import type { UserProfile } from "@/lib/types";

type FormState = {
  coach_persona: string;
  goal_type: string;
  gender: string;
  age: string;
  height_cm: string;
  current_weight_kg: string;
  target_weight_kg: string;
  body_shape: string;
  activity_level: string;
  medical_history: string;
};

const initialForm: FormState = {
  coach_persona: "mira",
  goal_type: "fat_loss",
  gender: "female",
  age: "25",
  height_cm: "165",
  current_weight_kg: "60",
  target_weight_kg: "55",
  body_shape: "balanced",
  activity_level: "light",
  medical_history: "none",
};

const steps = [
  { key: "goal_type", title: "你的当前目标是什么？", note: "目标会影响热量预算和执行节奏，我会先帮你把方向定准。" },
  { key: "gender", title: "你的性别是？", note: "性别会影响基础代谢和建议策略，这一步很关键。" },
  { key: "age", title: "你现在几岁？", note: "年龄会影响代谢、恢复速度和训练安排。" },
  { key: "height_cm", title: "你的身高是多少？", note: "身高和体重一起才能算出更准确的体型基线。" },
  { key: "current_weight_kg", title: "你当前体重是多少？", note: "先知道起点，我才能判断减脂空间和建议节奏。" },
  { key: "target_weight_kg", title: "你的目标体重是多少？", note: "目标不一定越低越好，我会尽量帮你设成可持续的数字。" },
  { key: "body_shape", title: "你的身体体型更接近哪一种？", note: "体型会帮助我更贴近你的脂肪分布和训练感受。" },
  { key: "activity_level", title: "你现在的运动习惯如何？", note: "我不会给你一套你根本执行不了的计划，所以这一步要真实。" },
  { key: "medical_history", title: "有需要特别注意的疾病史吗？", note: "有风险约束时，饮食和运动建议都必须更保守。" },
];

function calcBmi(heightCm: string, weightKg: string) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w) return null;
  const bmi = w / ((h / 100) * (h / 100));
  return Number(bmi.toFixed(1));
}

function calcWeightDelta(currentWeightKg: string, targetWeightKg: string) {
  const current = Number(currentWeightKg);
  const target = Number(targetWeightKg);
  if (!current || !target) return null;
  return Number((current - target).toFixed(1));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get<UserProfile>("/users/me/profile");
        const profile = res.data;
        if (profile.onboarding_completed) {
          router.replace("/");
          return;
        }
        setForm({
          coach_persona: profile.coach_persona || initialForm.coach_persona,
          goal_type: profile.goal_type || initialForm.goal_type,
          gender: profile.gender || initialForm.gender,
          age: profile.age ? String(profile.age) : initialForm.age,
          height_cm: profile.height_cm ? String(profile.height_cm) : initialForm.height_cm,
          current_weight_kg: profile.current_weight_kg ? String(profile.current_weight_kg) : initialForm.current_weight_kg,
          target_weight_kg: profile.target_weight_kg ? String(profile.target_weight_kg) : initialForm.target_weight_kg,
          body_shape: profile.body_shape || initialForm.body_shape,
          activity_level: profile.activity_level || initialForm.activity_level,
          medical_history: profile.medical_history || initialForm.medical_history,
        });
      } catch (loadError) {
        console.error(loadError);
        setError("初始化建档失败，请确认后端服务可用。");
      } finally {
        setBootstrapping(false);
      }
    }

    loadProfile();
  }, [router]);

  const selectedCoach = useMemo(() => getCoachPersona(form.coach_persona), [form.coach_persona]);
  const currentStep = steps[stepIndex];
  const bmi = calcBmi(form.height_cm, form.current_weight_kg);
  const weightDelta = calcWeightDelta(form.current_weight_kg, form.target_weight_kg);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canContinue() {
    const value = form[currentStep.key as keyof FormState];
    return String(value).trim().length > 0;
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      await api.put("/users/me/profile", {
        coach_persona: form.coach_persona,
        goal_type: form.goal_type,
        gender: form.gender,
        age: Number(form.age),
        height_cm: Number(form.height_cm),
        current_weight_kg: Number(form.current_weight_kg),
        target_weight_kg: Number(form.target_weight_kg),
        body_shape: form.body_shape,
        activity_level: form.activity_level,
        medical_history: form.medical_history,
        onboarding_completed: true,
      });
      router.replace("/");
    } catch (saveError) {
      console.error(saveError);
      setError("保存建档信息失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    switch (currentStep.key) {
      case "goal_type":
        return (
          <OptionGrid
            value={form.goal_type}
            onChange={(value) => updateField("goal_type", value)}
            options={[
              { value: "fat_loss", title: "减脂塑形", description: "先把体脂和体重拉回到更轻松的区间" },
              { value: "health", title: "更健康", description: "改善饮食结构和代谢状态" },
              { value: "energy", title: "更有活力", description: "希望日常状态更稳，不容易疲惫" },
              { value: "detox", title: "饮食重置", description: "把节奏拉回来，重建更干净的饮食习惯" },
            ]}
          />
        );
      case "gender":
        return (
          <OptionGrid
            value={form.gender}
            onChange={(value) => updateField("gender", value)}
            options={[
              { value: "male", title: "男生", description: "使用男性代谢参数估算热量目标" },
              { value: "female", title: "女生", description: "使用女性代谢参数估算热量目标" },
            ]}
          />
        );
      case "age":
        return <NumberWheel label="岁" value={form.age} onChange={(value) => updateField("age", value)} min={16} max={70} />;
      case "height_cm":
        return (
          <div className="space-y-6">
            <NumberWheel label="厘米" value={form.height_cm} onChange={(value) => updateField("height_cm", value)} min={140} max={210} />
            <MetricCard title="BMI 预估" value={bmi ? String(bmi) : "--"} description="输入当前体重后会更准确" />
          </div>
        );
      case "current_weight_kg":
        return (
          <div className="space-y-6">
            <NumberWheel label="公斤" value={form.current_weight_kg} onChange={(value) => updateField("current_weight_kg", value)} min={35} max={150} step={0.1} />
            <MetricCard title="当前 BMI" value={bmi ? String(bmi) : "--"} description="我会据此估算你的初始热量和营养目标" />
          </div>
        );
      case "target_weight_kg":
        return (
          <div className="space-y-6">
            <NumberWheel label="公斤" value={form.target_weight_kg} onChange={(value) => updateField("target_weight_kg", value)} min={35} max={150} step={0.1} />
            <MetricCard
              title="预计减重差值"
              value={weightDelta !== null ? `${weightDelta} kg` : "--"}
              description="目标不是越低越好，而是要能稳稳做到"
            />
          </div>
        );
      case "body_shape":
        return (
          <OptionGrid
            value={form.body_shape}
            onChange={(value) => updateField("body_shape", value)}
            options={[
              { value: "apple", title: "苹果型", description: "腰腹脂肪更集中，上半身更容易堆积" },
              { value: "pear", title: "梨型", description: "臀腿更容易囤积脂肪，下半身更明显" },
              { value: "balanced", title: "均衡型", description: "整体较平均，执行节奏更关键" },
            ]}
          />
        );
      case "activity_level":
        return (
          <OptionGrid
            value={form.activity_level}
            onChange={(value) => updateField("activity_level", value)}
            options={[
              { value: "sedentary", title: "不太运动", description: "久坐为主，很少主动运动" },
              { value: "light", title: "轻度运动", description: "每周 1-3 天，有散步或轻训练" },
              { value: "moderate", title: "中等运动", description: "每周 3-5 天，有稳定训练安排" },
              { value: "high", title: "高强度运动", description: "高频训练，需要更精细的吃动平衡" },
            ]}
          />
        );
      case "medical_history":
        return (
          <OptionGrid
            value={form.medical_history}
            onChange={(value) => updateField("medical_history", value)}
            options={[
              { value: "none", title: "都没有", description: "先按常规安全策略生成计划" },
              { value: "diabetes", title: "糖尿病", description: "更关注碳水质量和波动控制" },
              { value: "thyroid", title: "甲状腺问题", description: "饮食和减重节奏需要更保守" },
              { value: "cardio_or_joint", title: "心血管或关节问题", description: "运动强度和恢复安排需要限制" },
            ]}
          />
        );
      default:
        return null;
    }
  }

  if (bootstrapping) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">正在准备你的专属教练...</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#fff7f2_100%)] px-5 pb-10 pt-8">
      <div className="mb-6 flex items-center justify-between text-sm text-slate-500">
        <button type="button" onClick={() => router.push("/")} className="rounded-full border border-slate-200 px-3 py-1.5">稍后再说</button>
        <span>{stepIndex + 1}/{steps.length}</span>
      </div>

      <div className="rounded-[28px] bg-white/88 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className={`mb-5 rounded-[24px] bg-gradient-to-br ${selectedCoach.gradientClass} p-5 text-white`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm/5 text-white/80">选择你的专属私教</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{selectedCoach.name}</h1>
            </div>
            <span className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.2em]">{selectedCoach.mbti}</span>
          </div>
          <p className="max-w-[18rem] text-sm/6 text-white/90">{selectedCoach.greeting}</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {coachPersonas.map((persona) => {
            const active = persona.id === form.coach_persona;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => updateField("coach_persona", persona.id)}
                className={`rounded-3xl border px-4 py-4 text-left transition ${active ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
              >
                <div className="text-sm font-semibold">{persona.name}</div>
                <div className="mt-1 text-[11px] opacity-70">{persona.style}</div>
              </button>
            );
          })}
        </div>

        <div className="mb-5">
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full bg-gradient-to-r ${selectedCoach.gradientClass}`} style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{currentStep.title}</h2>
          <p className="mt-3 text-sm/6 text-slate-500">{selectedCoach.name}：{currentStep.note}</p>
        </div>

        {renderStep()}

        {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={stepIndex === 0}
            className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 disabled:opacity-40"
          >
            上一步
          </button>
          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={!canContinue()}
              className="flex-[1.4] rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || !canContinue()}
              className="flex-[1.4] rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "正在生成建档结果..." : "完成建档"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionGrid({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; title: string; description: string }>;
}) {
  return (
    <div className="space-y-3">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`w-full rounded-[24px] border p-4 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"}`}
          >
            <div className="text-lg font-semibold">{option.title}</div>
            <div className={`mt-1 text-sm ${active ? "text-white/80" : "text-slate-500"}`}>{option.description}</div>
          </button>
        );
      })}
    </div>
  );
}

function NumberWheel({ label, value, onChange, min, max, step = 1 }: { label: string; value: string; onChange: (value: string) => void; min: number; max: number; step?: number }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
      <div className="mb-3 text-sm text-slate-500">滑动或输入更准确的数字</div>
      <div className="flex items-end gap-3">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border-none bg-transparent text-6xl font-semibold tracking-tight outline-none"
        />
        <span className="pb-3 text-xl text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
      <div className="text-sm text-emerald-700">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-emerald-950">{value}</div>
      <div className="mt-2 text-sm text-emerald-800/80">{description}</div>
    </div>
  );
}
