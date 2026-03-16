export interface DailySummary {
  summary_date: string;
  total_calories_kcal: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carb_g: number;
  meals_count: number;
  total_exercise_calories_kcal: number;
  exercise_count: number;
  calorie_target: number | null;
  calorie_remaining_kcal: number | null;
  calorie_deficit_kcal: number | null;
}

export interface MealItem {
  id: number;
  food_id: number | null;
  recognized_name: string | null;
  amount_g: number | null;
  calories_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
}

export interface MealLog {
  id: number;
  meal_type: string | null;
  meal_date: string;
  input_mode: string | null;
  total_calories_kcal: number | null;
  total_protein_g: number | null;
  total_fat_g: number | null;
  total_carb_g: number | null;
  ai_summary: string | null;
  created_at: string;
  items: MealItem[];
}

export interface ExerciseLog {
  id: number;
  exercise_type: string;
  exercise_date: string;
  duration_minutes: number;
  calories_burned_kcal: number;
  notes: string | null;
  ai_summary: string | null;
  created_at: string;
}

export interface WeeklyReviewDay {
  summary_date: string;
  total_calories_kcal: number;
  total_exercise_calories_kcal: number;
  calorie_deficit_kcal: number;
  weight_kg: number | null;
  status: string;
}

export interface WeeklyReview {
  week_start: string;
  week_end: string;
  daily_items: WeeklyReviewDay[];
  weekly_summary_ai: string;
  weight_change_kg: number | null;
}

export interface ParsedFood {
  food_name: string;
  amount_g: number;
  food_id: number | null;
  calories_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
}

export interface MealParseResult {
  items: ParsedFood[];
  total_calories_kcal: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carb_g: number;
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AgentPlanStep {
  id: string;
  tool: string;
  purpose: string;
  status: string;
}

export interface AgentTraceStep {
  step_id: string;
  tool: string;
  purpose: string;
  status: string;
  summary: string;
}

export interface ChatApiResponse {
  response: string;
  intent?: string | null;
  mode?: string | null;
  plan?: AgentPlanStep[] | null;
  execution_trace?: AgentTraceStep[] | null;
  context_snapshot?: {
    calorie_remaining?: number;
    calorie_deficit?: number;
  } | null;
  requires_clarification?: boolean;
  clarification_question?: string | null;
  missing_fields?: string[] | null;
  resumed_from_clarification?: boolean;
}

export interface UserProfile {
  user_id: number;
  coach_persona: string | null;
  goal_type: string | null;
  gender: string | null;
  age: number | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  body_shape: string | null;
  activity_level: string | null;
  medical_history: string | null;
  onboarding_completed: boolean;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  fat_target_g: number | null;
  carb_target_g: number | null;
  taste_preference: string | null;
  allergies: string | null;
  dietary_restrictions: string | null;
  bmi: number | null;
  weight_delta_kg: number | null;
}
