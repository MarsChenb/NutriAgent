export interface DailySummary {
  summary_date: string;
  total_calories_kcal: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carb_g: number;
  meals_count: number;
  calorie_target: number | null;
  calorie_remaining_kcal: number | null;
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

export interface ParsedFood {
  food_name: string;
  amount_g: number;
  food_id: number | null;
  calories_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
