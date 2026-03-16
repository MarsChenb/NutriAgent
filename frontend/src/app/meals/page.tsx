"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Flame,
  ImagePlus,
  PencilLine,
  Salad,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import type { MealParseResult, ParsedFood } from "@/lib/types";

const mealTypes = [
  { key: "breakfast", label: "早餐", hint: "先把蛋白质和主食稳住，上午更不容易乱吃。" },
  { key: "lunch", label: "午餐", hint: "中午吃得清晰，下午的状态会稳定很多。" },
  { key: "dinner", label: "晚餐", hint: "控制晚间热量波动，是保住缺口的关键。" },
  { key: "snack", label: "加餐", hint: "把小零食算进预算，才不会悄悄超标。" },
] as const;

const textExamples = [
  "晚餐吃了 150g 鸡胸肉、半碗米饭和一份生菜沙拉",
  "早餐是两个鸡蛋、一杯无糖豆浆和两片全麦面包",
  "下午加餐喝了酸奶，吃了一根香蕉和一小把坚果",
];

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

function NutritionPill({ label, value, unit, tone }: { label: string; value: number; unit: string; tone: string }) {
  return (
    <div className="soft-panel rounded-[22px] px-4 py-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${tone}`}>
        {Math.round(value)}
        <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>
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
  const activeMeal = mealTypes.find((item) => item.key === mealType) ?? mealTypes[1];

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
      setError("文字解析失败，请稍后重试。");
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
      setError("图片识别失败，请换一张更清晰的照片再试。");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    const validItems = parsedItems.filter((item) => item.food_id);
    if (validItems.length === 0) {
      setError("还没有可保存的食物项，请先完成识别。未匹配到食物库的条目暂时不能保存。");
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
      setResult(`记录成功，这一餐约 ${totalCal} kcal，AI 点评也已经生成。`);
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
    <div className="px-4 pb-36 pt-5">
      <section className="rounded-[34px] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(246,243,255,0.96))] px-5 py-6 shadow-[0_20px_40px_rgba(149,145,201,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(`/?date=${mealDate}`)}
            className="glass-card flex h-11 w-11 items-center justify-center rounded-full text-slate-700"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <div className="rounded-full bg-[#f4f1ff] px-3 py-1.5 text-xs font-medium text-[#6f63ff]">
              {inputMode === "text" ? "文字记录" : "图片识别"}
            </div>
            <div className="rounded-full bg-[#e9fbf7] px-3 py-1.5 text-xs font-medium text-[#2bbba5]">{activeMeal.label}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Meal Capture</div>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-slate-950">记录这顿吃了什么</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">{activeMeal.hint}</p>
        </div>

        <div className="mt-5 rounded-[24px] bg-white/78 px-4 py-4">
          <div className="text-xs text-slate-400">记录日期</div>
          <input
            type="date"
            value={mealDate}
            onChange={(event) => setMealDate(event.target.value)}
            className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>
      </section>

      <section className="mt-5 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {mealTypes.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMealType(key)}
              className={`rounded-[24px] px-5 py-3 text-sm font-medium transition ${
                mealType === key ? "bg-[#1e1c2b] text-white shadow-[0_14px_24px_rgba(30,28,43,0.18)]" : "glass-card text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card mt-5 rounded-[30px] px-5 py-5">
        <div className="flex rounded-[22px] bg-[#f5f3ff] p-1.5">
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              inputMode === "text" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
            }`}
          >
            <PencilLine className="h-4 w-4" />
            文字记录
          </button>
          <button
            type="button"
            onClick={() => setInputMode("image")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              inputMode === "image" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
            }`}
          >
            <Camera className="h-4 w-4" />
            图片识别
          </button>
        </div>

        {inputMode === "text" ? (
          <div className="mt-5">
            <div className="mb-3 text-sm leading-6 text-slate-500">用一句话描述这顿吃了什么，系统会自动拆成食物项、克数和营养值。</div>
            <textarea
              className="min-h-[150px] w-full resize-none rounded-[28px] border border-[#ebe7ff] bg-[#fbfaff] px-4 py-4 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="例如：晚餐吃了 150g 鸡胸肉、半碗米饭和一份生菜沙拉"
              value={text}
              onChange={(event) => {
                setInputMode("text");
                setText(event.target.value);
              }}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {textExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setInputMode("text");
                    setText(example);
                  }}
                  className="rounded-full bg-[#f5f3ff] px-3 py-2 text-xs text-slate-600"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-3 text-sm leading-6 text-slate-500">上传一张餐食照片，系统会尝试识别食物并估算克数和营养值。</div>
            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[30px] border border-dashed border-[#ddd7ff] bg-[#fbfaff] px-4 py-6 text-center">
              <input type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
              {previewUrl ? (
                <img src={previewUrl} alt="meal preview" className="max-h-[240px] rounded-[24px] object-cover" />
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f1edff] text-[#6f63ff]">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-base font-medium text-slate-900">点击上传餐食图片</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">建议使用光线更均匀、食物主体更清晰的照片。</div>
                </>
              )}
            </label>
          </div>
        )}
      </section>

      {(parsedItems.length > 0 || error || result) && (
        <section className="glass-card mt-5 rounded-[30px] px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Analysis</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">识别结果</h2>
            </div>
            <div className="rounded-full bg-[#f4f1ff] px-3 py-1.5 text-xs font-medium text-[#6f63ff]">
              {inputMode === "text" ? "文本解析" : "图片识别"}
            </div>
          </div>

          {error && <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-600">{error}</div>}
          {result && <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">{result}</div>}

          {parsedItems.length > 0 && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <NutritionPill label="总热量" value={parseTotals.total_calories_kcal} unit="kcal" tone="text-[#2bbba5]" />
                <NutritionPill label="蛋白质" value={parseTotals.total_protein_g} unit="g" tone="text-[#6f63ff]" />
                <NutritionPill label="脂肪" value={parseTotals.total_fat_g} unit="g" tone="text-[#ff9b6a]" />
                <NutritionPill label="碳水" value={parseTotals.total_carb_g} unit="g" tone="text-[#6a88ff]" />
              </div>

              <div className="mt-5 space-y-3">
                {parsedItems.map((item, idx) => (
                  <div key={`${item.food_name}-${idx}`} className="soft-panel rounded-[24px] px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f1ff] text-[#6f63ff]">
                          <Salad className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-slate-950">{item.food_name}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            约 {item.amount_g} g {item.food_id ? "· 已匹配食物库" : "· 暂未匹配食物库"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm font-semibold text-[#ff8b6a]">
                          <Flame className="h-4 w-4" />
                          {item.calories_kcal != null ? `${Math.round(item.calories_kcal)} kcal` : "--"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">P {item.protein_g ?? 0} / F {item.fat_g ?? 0} / C {item.carb_g ?? 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="fixed bottom-20 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4 md:bottom-24">
        <div className="glass-card rounded-[30px] px-3 py-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-medium text-slate-900">完成这次记录</div>
              <div className="text-xs text-slate-500">
                {parsedItems.length > 0 ? "确认后会回写首页预算，并生成这一餐的 AI 点评。" : "先解析，再确认保存。"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="flex items-center gap-1 rounded-full bg-[#f4f1ff] px-3 py-1.5 text-xs font-medium text-[#6f63ff]"
            >
              问 Agent
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={inputMode === "text" ? handleTextParse : handleImageParse}
              disabled={parsing || (inputMode === "text" ? !text.trim() : !imageFile)}
              className="rounded-[22px] bg-[#1e1c2b] px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {parsing ? "解析中..." : inputMode === "text" ? "解析这顿餐食" : "识别这张图片"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !canSave}
              className="rounded-[22px] bg-[linear-gradient(135deg,#7b6cff,#9b7bff)] px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "保存中..." : "确认记录并回首页"}
            </button>
          </div>
        </div>
      </section>

      {parsedItems.length === 0 && !error && !result && (
        <section className="mt-5 rounded-[28px] bg-white/62 px-5 py-5 text-sm leading-7 text-slate-500 shadow-[0_14px_28px_rgba(149,145,201,0.08)]">
          <div className="mb-3 flex items-center gap-2 text-slate-900">
            <Sparkles className="h-4 w-4 text-[#6f63ff]" />
            <span className="font-medium">记录建议</span>
          </div>
          食物名称越具体、份量越清晰，解析结果就越稳。如果你懒得细写，也可以先拍图，等识别后再决定要不要保存。
        </section>
      )}
    </div>
  );
}
