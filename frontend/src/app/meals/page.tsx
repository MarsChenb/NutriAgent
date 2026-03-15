"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import type { MealParseResult, ParsedFood } from "@/lib/types";

const mealTypes = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
] as const;

type InputMode = "text" | "image";

type PageParams = {
  mealType: string;
  date: string;
  mode: InputMode;
  prefill: string;
};

function readMealsParams(): PageParams {
  if (typeof window === "undefined") {
    return {
      mealType: "lunch",
      date: format(new Date(), "yyyy-MM-dd"),
      mode: "text",
      prefill: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "image" ? "image" : "text";
  return {
    mealType: params.get("mealType") || "lunch",
    date: params.get("date") || format(new Date(), "yyyy-MM-dd"),
    mode,
    prefill: params.get("prefill") || "",
  };
}

function NutritionPill({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">
        {value.toFixed(1)} {unit}
      </div>
    </div>
  );
}

export default function MealsPage() {
  const router = useRouter();
  const initialParams = readMealsParams();

  const [inputMode, setInputMode] = useState<InputMode>(initialParams.mode);
  const [text, setText] = useState(initialParams.prefill);
  const [mealType, setMealType] = useState(initialParams.mealType);
  const [mealDate, setMealDate] = useState(initialParams.date);
  const [parsedItems, setParsedItems] = useState<ParsedFood[]>([]);
  const [parseTotals, setParseTotals] = useState<Omit<MealParseResult, "items" | "error">>({
    total_calories_kcal: 0,
    total_protein_g: 0,
    total_fat_g: 0,
    total_carb_g: 0,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = readMealsParams();
    setMealType(params.mealType);
    setMealDate(params.date);
    setInputMode(params.mode);
    setText(params.prefill);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const canSave = useMemo(() => parsedItems.some((item) => item.food_id), [parsedItems]);

  function resetParsedState() {
    setParsedItems([]);
    setParseTotals({
      total_calories_kcal: 0,
      total_protein_g: 0,
      total_fat_g: 0,
      total_carb_g: 0,
    });
    setResult(null);
    setError(null);
  }

  async function handleTextParse() {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<MealParseResult>("/meals/parse", { text, meal_type: mealType });
      setParsedItems(res.data.items);
      setParseTotals({
        total_calories_kcal: res.data.total_calories_kcal,
        total_protein_g: res.data.total_protein_g,
        total_fat_g: res.data.total_fat_g,
        total_carb_g: res.data.total_carb_g,
      });
    } catch (parseError) {
      console.error(parseError);
      setError("文本解析失败，请重试。");
    } finally {
      setParsing(false);
    }
  }

  async function handleImageParse() {
    if (!imageFile) return;
    setParsing(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const res = await api.post<MealParseResult>("/meals/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.error) {
        setError(res.data.error);
        return;
      }
      setParsedItems(res.data.items);
      setParseTotals({
        total_calories_kcal: res.data.total_calories_kcal,
        total_protein_g: res.data.total_protein_g,
        total_fat_g: res.data.total_fat_g,
        total_carb_g: res.data.total_carb_g,
      });
    } catch (parseError) {
      console.error(parseError);
      setError("图片识别失败，请稍后再试。");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    const validItems = parsedItems.filter((item) => item.food_id);
    if (validItems.length === 0) {
      setError("没有可保存的食物项，请先完成识别。未匹配到食物库的项暂时不能保存。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.post("/meals/", {
        meal_type: mealType,
        meal_date: mealDate,
        input_mode: inputMode,
        items: validItems.map((item) => ({ food_id: item.food_id, amount_g: item.amount_g })),
        raw_input: inputMode === "text" ? text : `image:${imageFile?.name || "upload"}`,
      });
      const totalCal = Math.round(res.data.total_calories_kcal || 0);
      setResult(`记录成功，本餐合计 ${totalCal} kcal，AI 已生成点评。`);
      setText("");
      setImageFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      resetParsedState();
      router.push(`/?date=${mealDate}`);
    } catch (saveError) {
      console.error(saveError);
      setError("保存餐食失败，请确认后端服务可用。");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setInputMode("image");
    setImageFile(file);
    resetParsedState();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_40%)] p-4 pb-24">
      <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">餐次记录</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {mealTypes.find((item) => item.key === mealType)?.label || "餐食"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">记录日期：{mealDate}</p>
          </div>
          <button onClick={() => router.push(`/?date=${mealDate}`)} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
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
        <div className="flex rounded-2xl bg-slate-100 p-1">
          <button
            onClick={() => setInputMode("text")}
            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${inputMode === "text" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
          >
            文字记录
          </button>
          <button
            onClick={() => setInputMode("image")}
            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${inputMode === "image" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
          >
            图片识别
          </button>
        </div>

        {inputMode === "text" ? (
          <div className="mt-4">
            <div className="mb-3 text-sm text-slate-500">用一句话描述你吃了什么，AI 会帮你拆成食物项、分量和营养值。</div>
            <textarea
              className="min-h-[120px] w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none placeholder:text-slate-400"
              placeholder="例如：晚餐吃了 150g 鸡胸肉、半碗米饭和一份生菜沙拉"
              value={text}
              onChange={(event) => {
                setInputMode("text");
                setText(event.target.value);
              }}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleTextParse}
                disabled={parsing || !text.trim()}
                className="rounded-full bg-slate-950 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {parsing ? "AI 解析中..." : "解析食物"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-3 text-sm text-slate-500">上传一张餐食图片，AI 会尝试识别食物项并估算克数与营养。</div>
            <label className="flex min-h-[180px] cursor-pointer items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              <input type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
              {previewUrl ? (
                <img src={previewUrl} alt="meal preview" className="max-h-[220px] rounded-2xl object-cover" />
              ) : (
                <span>点击上传餐食图片</span>
              )}
            </label>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleImageParse}
                disabled={parsing || !imageFile}
                className="rounded-full bg-slate-950 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {parsing ? "识别中..." : "识别图片"}
              </button>
            </div>
          </div>
        )}
      </div>

      {(parsedItems.length > 0 || error || result) && (
        <div className="mt-4 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">识别与营养结果</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{inputMode === "text" ? "文本解析" : "图片识别"}</span>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
          {result && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{result}</div>}

          {parsedItems.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <NutritionPill label="总热量" value={parseTotals.total_calories_kcal} unit="kcal" />
                <NutritionPill label="蛋白质" value={parseTotals.total_protein_g} unit="g" />
                <NutritionPill label="脂肪" value={parseTotals.total_fat_g} unit="g" />
                <NutritionPill label="碳水" value={parseTotals.total_carb_g} unit="g" />
              </div>

              <div className="mt-5 space-y-3">
                {parsedItems.map((item, idx) => (
                  <div key={`${item.food_name}-${idx}`} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{item.food_name}</div>
                        <div className="mt-1 text-xs text-slate-500">约 {item.amount_g} g {item.food_id ? "· 已匹配食物库" : "· 未匹配食物库"}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-orange-500">{item.calories_kcal != null ? `${Math.round(item.calories_kcal)} kcal` : "--"}</div>
                        <div className="mt-1 text-xs text-slate-500">P {item.protein_g ?? 0} / F {item.fat_g ?? 0} / C {item.carb_g ?? 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={handleConfirm}
                  disabled={saving || !canSave}
                  className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {saving ? "保存中..." : "确认记录并生成点评"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
