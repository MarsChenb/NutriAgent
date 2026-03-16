"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Heart, Leaf, MoonStar, Sparkles, SunMedium, Target } from "lucide-react";
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
  { key: "goal_type", title: "先告诉我，这次你最想接近什么目标？", note: "目标会影响热量预算、营养结构和建议节奏。" },
  { key: "gender", title: "你的性别是？", note: "这一项只用于估算更稳的基础代谢和建议范围。" },
  { key: "age", title: "你现在几岁？", note: "年龄会影响恢复速度、训练安排和减脂节奏。" },
  { key: "height_cm", title: "你的身高是多少？", note: "身高和体重一起，才能算出更有参考价值的基础指标。" },
  { key: "current_weight_kg", title: "你当前体重是多少？", note: "我会基于起点给你更现实的预算和建议。" },
  { key: "target_weight_kg", title: "你的目标体重是多少？", note: "目标不是越低越好，而是越能长期做到越好。" },
  { key: "body_shape", title: "你的体型更接近哪一种？", note: "这能帮助我更贴近你的身体感受和关注重点。" },
  { key: "activity_level", title: "你现在的运动习惯如何？", note: "计划一定要符合你的真实节奏，不然再漂亮也落不了地。" },
  { key: "medical_history", title: "有没有需要特别注意的身体情况？", note: "有约束条件时，饮食和运动建议都要更保守。" },
] as const;

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

function readEditorState() {
  if (typeof window === "undefined") {
    return { isEditMode: false, nextPath: "/" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    isEditMode: params.get("mode") === "edit",
    nextPath: params.get("next") || "/",
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ isEditMode: boolean; nextPath: string } | null>(null);
  const isEditMode = editorState?.isEditMode ?? false;
  const nextPath = editorState?.nextPath ?? "/";

  useEffect(() => {
    setEditorState(readEditorState());
  }, []);

  useEffect(() => {
    if (!editorState) {
      return;
    }

    async function loadProfile() {
      try {
        const res = await api.get<UserProfile>("/users/me/profile");
        const profile = res.data;
        if (profile.onboarding_completed && !isEditMode) {
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
  }, [editorState, isEditMode, router]);

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
      router.replace(nextPath);
    } catch (saveError) {
      console.error(saveError);
      setError(isEditMode ? "更新资料失败，请稍后重试。" : "保存建档信息失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    switch (currentStep.key) {
      case "goal_type":
        return (
          <OptionStack
            value={form.goal_type}
            onChange={(value) => updateField("goal_type", value)}
            options={[
              { value: "fat_loss", title: "减脂塑形", description: "希望体脂和体重一起回到更轻松的区间。", icon: Target },
              { value: "health", title: "更健康", description: "想把饮食结构和作息慢慢调回正轨。", icon: Heart },
              { value: "energy", title: "更有活力", description: "希望状态更稳，不容易疲劳和暴食。", icon: SunMedium },
              { value: "detox", title: "饮食重置", description: "想先把节奏拉回来，建立更干净的习惯。", icon: Leaf },
            ]}
          />
        );
      case "gender":
        return (
          <OptionStack
            value={form.gender}
            onChange={(value) => updateField("gender", value)}
            options={[
              { value: "female", title: "女生", description: "按女性代谢参数估算计划。", icon: Sparkles },
              { value: "male", title: "男生", description: "按男性代谢参数估算计划。", icon: Activity },
            ]}
          />
        );
      case "age":
        return <NumberCard label="岁" value={form.age} onChange={(value) => updateField("age", value)} min={16} max={70} />;
      case "height_cm":
        return (
          <div className="space-y-5">
            <NumberCard label="厘米" value={form.height_cm} onChange={(value) => updateField("height_cm", value)} min={140} max={210} />
            <MetricCard title="当前 BMI 预估" value={bmi ? String(bmi) : "--"} description="输入体重后会更有参考意义。" />
          </div>
        );
      case "current_weight_kg":
        return (
          <div className="space-y-5">
            <NumberCard label="公斤" value={form.current_weight_kg} onChange={(value) => updateField("current_weight_kg", value)} min={35} max={150} step={0.1} />
            <MetricCard title="当前 BMI" value={bmi ? String(bmi) : "--"} description="这会直接影响热量目标和营养预算。" />
          </div>
        );
      case "target_weight_kg":
        return (
          <div className="space-y-5">
            <NumberCard label="公斤" value={form.target_weight_kg} onChange={(value) => updateField("target_weight_kg", value)} min={35} max={150} step={0.1} />
            <MetricCard title="预计差值" value={weightDelta !== null ? `${weightDelta} kg` : "--"} description="后面我会按这个目标帮你控制节奏。" />
          </div>
        );
      case "body_shape":
        return (
          <OptionStack
            value={form.body_shape}
            onChange={(value) => updateField("body_shape", value)}
            options={[
              { value: "apple", title: "苹果型", description: "腰腹更容易囤积脂肪。", icon: Target },
              { value: "pear", title: "梨型", description: "臀腿更容易堆积脂肪。", icon: Heart },
              { value: "balanced", title: "均衡型", description: "整体较均匀，执行节奏更关键。", icon: Sparkles },
            ]}
          />
        );
      case "activity_level":
        return (
          <OptionStack
            value={form.activity_level}
            onChange={(value) => updateField("activity_level", value)}
            options={[
              { value: "sedentary", title: "基本不运动", description: "久坐为主，很少主动训练。", icon: MoonStar },
              { value: "light", title: "轻度运动", description: "每周 1-3 天，偶尔散步或轻训练。", icon: SunMedium },
              { value: "moderate", title: "稳定训练", description: "每周 3-5 天，已经有基本节奏。", icon: Activity },
              { value: "high", title: "高频训练", description: "训练频繁，需要更细的吃动平衡。", icon: Sparkles },
            ]}
          />
        );
      case "medical_history":
        return (
          <OptionStack
            value={form.medical_history}
            onChange={(value) => updateField("medical_history", value)}
            options={[
              { value: "none", title: "没有特别情况", description: "先按常规安全策略生成计划。", icon: Heart },
              { value: "diabetes", title: "血糖问题", description: "更关注碳水质量和波动控制。", icon: Target },
              { value: "thyroid", title: "甲状腺相关", description: "减脂节奏和饮食建议要更保守。", icon: MoonStar },
              { value: "cardio_or_joint", title: "心血管或关节问题", description: "运动强度和恢复安排需要限制。", icon: Activity },
            ]}
          />
        );
      default:
        return null;
    }
  }

  if (bootstrapping || !editorState) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card w-full rounded-[32px] px-6 py-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[linear-gradient(135deg,#7b6cff,#9adfd7)]" />
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">正在唤醒你的专属私教</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">建档信息和教练偏好正在同步中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(nextPath)}
          className="glass-card flex h-11 w-11 items-center justify-center rounded-full text-slate-700"
          aria-label="返回首页"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-sm font-medium text-slate-500">
          {isEditMode ? `编辑资料 · ${stepIndex + 1}/${steps.length}` : `${stepIndex + 1}/${steps.length}`}
        </div>
      </div>

      <section className={`rounded-[34px] bg-gradient-to-br ${selectedCoach.gradientClass} px-5 py-6 text-white shadow-[0_24px_60px_rgba(111,99,255,0.22)]`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/75">{isEditMode ? "更新你的专属私教与健康档案" : "选择你的专属私教"}</div>
            <div className="mt-2 text-[32px] font-semibold tracking-tight">{selectedCoach.name}</div>
          </div>
          <div className="rounded-full border border-white/30 px-3 py-1 text-xs tracking-[0.18em]">{selectedCoach.mbti}</div>
        </div>
        <p className="mt-4 max-w-[280px] text-sm leading-7 text-white/88">
          {isEditMode ? "这里可以重新调整教练类型、目标和身体资料。保存后，首页预算和 Agent 上下文会一起刷新。" : selectedCoach.greeting}
        </p>
      </section>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {coachPersonas.map((persona) => {
          const active = persona.id === form.coach_persona;
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => updateField("coach_persona", persona.id)}
              className={`rounded-[26px] px-4 py-4 text-left transition ${
                active ? "bg-[#1e1c2b] text-white shadow-[0_16px_28px_rgba(30,28,43,0.18)]" : "glass-card text-slate-700"
              }`}
            >
              <div className="text-base font-semibold">{persona.name}</div>
              <div className={`mt-1 text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{persona.style}</div>
            </button>
          );
        })}
      </div>

      <section className="glass-card mt-5 rounded-[34px] px-5 py-6">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${selectedCoach.gradientClass}`}
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-6">
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-slate-950">{currentStep.title}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            <span className={`font-semibold ${selectedCoach.accentClass}`}>{selectedCoach.name}</span>
            {" · "}
            {currentStep.note}
          </p>
        </div>

        <div className="mt-6">{renderStep()}</div>

        {error && <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
          disabled={stepIndex === 0}
          className="glass-card flex-1 rounded-full px-5 py-4 text-sm font-medium text-slate-500 disabled:opacity-40"
        >
          上一步
        </button>
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
            disabled={!canContinue()}
            className="flex-[1.4] rounded-full bg-[#1e1c2b] px-5 py-4 text-sm font-medium text-white disabled:opacity-40"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving || !canContinue()}
            className="flex-[1.4] rounded-full bg-[#1e1c2b] px-5 py-4 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? (isEditMode ? "正在更新你的资料..." : "正在生成你的建档结果...") : isEditMode ? "保存资料" : "完成建档"}
          </button>
        )}
      </div>
    </div>
  );
}

function OptionStack({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; title: string; description: string; icon: typeof Sparkles }>;
}) {
  return (
    <div className="space-y-3">
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`w-full rounded-[28px] px-4 py-4 text-left transition ${
              active ? "bg-[#1e1c2b] text-white shadow-[0_16px_28px_rgba(30,28,43,0.18)]" : "soft-panel text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${active ? "bg-white/12 text-white" : "bg-white text-[#6f63ff]"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">{option.title}</div>
                <div className={`mt-1 text-sm leading-6 ${active ? "text-white/75" : "text-slate-500"}`}>{option.description}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function NumberCard({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="soft-panel rounded-[28px] px-5 py-5">
      <div className="text-sm text-slate-400">可以直接输入，也可以手动调整到更准确的数字。</div>
      <div className="mt-6 flex items-end gap-3">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border-none bg-transparent text-[56px] font-semibold tracking-tight text-slate-950 outline-none"
        />
        <span className="pb-3 text-lg text-slate-400">{label}</span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[26px] bg-[linear-gradient(135deg,rgba(123,108,255,0.1),rgba(159,244,228,0.18))] px-5 py-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-[34px] font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{description}</div>
    </div>
  );
}
