export type EvidenceTier = 1 | 2 | 3 | 4;

export type CookingFatCategory =
  | 'observable_low'
  | 'observable_moderate'
  | 'unobservable_unknown';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';

export type GoalMode =
  | 'aggressive_cut'
  | 'moderate_cut'
  | 'maintenance'
  | 'lean_bulk'
  | 'lean_mass';

export interface FoodItemEntry {
  id: string;
  name: string;
  grams: number;
  tier: EvidenceTier;
  tierSource: string;
  confidence: number;
  reportedCalories: number;
  calculatedCalories: number;
  calories: number;
  minCalories: number;
  maxCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol?: number;
  hasAtwaterDiscrepancy: boolean;
  cookingFatCategory: CookingFatCategory;
  fdcId?: string;
  barcode?: string;
  volumeCm3?: number;
  densityGPerCm3?: number;
  referenceAnchor?: string;
  servingMultiplier?: number;
  baseServingGrams?: number;
  scanMode?: 'plate_vision' | 'nutrition_label_ocr';
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  title: string;
  createdAt: string;
  thumbnailDataUrl?: string;
  items: FoodItemEntry[];
  totalCalories: number;
  minCalories: number;
  maxCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium: number;
  hasUnobservableFats: boolean;
  hasAtwaterDiscrepancy: boolean;
  isDemoMode?: boolean;
}

export interface DaySummary {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium: number;
  waterMl: number;
  meals: MealEntry[];
  updatedAt: string;
}

export interface UserBiometrics {
  age: number;
  gender: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalMode: GoalMode;
  bmr: number;
  baselineTdee: number;
  adaptiveTdee: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  onboarded: boolean;
}

export interface WeightLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  smoothedWeightKg: number;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  uid: string;
  category: 'bug' | 'nutrition_fix' | 'account' | 'feedback';
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
