"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import type { ParsedFood } from "@/lib/types";

const mealTypes = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
] as const;

function readMealsParams() {
  if (typeof window === "undefined") {
    return {
      mealType: "lunch",
      date: format(new Date(), "yyyy-MM-dd"),
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    mealType: params.get("mealType") || "lunch",
    date: params.get("date") || format(new Date(), "yyyy-MM-dd"),
  };
}

export default function MealsPage() {
  const router = useRouter();
  const initialParams = readMealsParams();

  const [text, setText] = useState("");
  const [mealType, setMealType] = useState(initialParams.mealType);
  const [mealDate, setMealDate] = useState(initialParams.date);
  const [parsedItems, setParsedItems] = useState<ParsedFood[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const params = readMealsParams();
    setMealType(params.mealType);
    setMealDate(params.date);
  }, []);

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setResult(null);
    try {
      const res = await api.post("/meals/parse", { text, meal_type: mealType });
      setParsedItems(res.data.items);
    } catch (error) {
      console.error(error);
      alert("解析失败，请重试");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    const validItems = parsedItems.filter((item) => item.food_id);
    if (validItems.length === 0) {
      alert("没有可记录的食物，请先完成识别");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/meals/", {
        meal_type: mealType,
        meal_date: mealDate,
        items: validItems.map((item) => ({ food_id: item.food_id, amount_g: item.amount_g })),
        raw_input: text,
      });
      const totalCal = Math.round(res.data.total_calories_kcal);
      setResult(`记录成功，本餐合计 ${totalCal} kcal`);
      setParsedItems([]);
      setText("");
      router.push(`/?date=${mealDate}`);
    } catch (error) {
      console.error(error);
      alert("记录失败，请确认后端服务可用");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_40%)] p-4 pb-24">
      <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">餐次记录</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{mealTypes.find((item) => item.key === mealType)?.label || "餐食"}</h1>
            <p className="mt-2 text-sm text-slate-500">记录日期：{mealDate}</p>
          </div>
          <button onClick={() => router.push("/")} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
            返回首页
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {mealTypes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMealType(key)}
              className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${mealType === key ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <label className="text-xs text-slate-500">记录日期</label>
          <input
            type="date"
            value={mealDate}
            onChange={(event) => setMealDate(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>
      </div>

      <div className="mt-4 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">用一句话描述你吃了什么，AI 会先帮你识别食物和分量。</div>
        <textarea
          className="min-h-[120px] w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none placeholder:text-slate-400"
          placeholder="例如：晚餐吃了 150g 鸡胸肉、半碗米饭和一份生菜沙拉"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="rounded-full bg-slate-950 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {parsing ? "AI 解析中..." : "解析食物"}
          </button>
        </div>
      </div>

      {parsedItems.length > 0 && (
        <div className="mt-4 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-950">识别结果</h3>
            <span className="text-sm text-slate-500">{Math.round(parsedItems.reduce((sum, item) => sum + (item.calories_kcal || 0), 0))} kcal</span>
          </div>
          <div className="space-y-3">
            {parsedItems.map((item, idx) => (
              <div key={`${item.food_name}-${idx}`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.food_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.amount_g} g {item.food_id ? "· 已匹配食物库" : "· 未匹配食物库"}</div>
                </div>
                <div className="text-sm font-semibold text-orange-500">{item.calories_kcal != null ? `${Math.round(item.calories_kcal)} kcal` : "--"}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "保存中..." : "确认记录"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          {result}
        </div>
      )}
    </div>
  );
}
