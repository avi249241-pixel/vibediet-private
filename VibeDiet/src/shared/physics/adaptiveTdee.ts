export function calculateMifflinStJeorBmr(
  gender: 'male' | 'female',
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.floor(gender === 'male' ? base + 5 : base - 161);
}

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
} as const;

export const GOAL_DELTAS = {
  aggressive_cut: -0.25,
  moderate_cut: -0.15,
  maintenance: 0.0,
  lean_bulk: 0.10,
  lean_mass: 0.10,
  fat_loss: -0.15,
  lean_gain: 0.10,
} as const;

export function calculateTargetCaloriesWithFloor(
  tdee: number,
  gender: 'male' | 'female',
  goalMode: keyof typeof GOAL_DELTAS | string
): number {
  const floor = gender === 'male' ? 1500 : 1200;
  const delta = (GOAL_DELTAS as Record<string, number>)[goalMode] ?? -0.15;
  const raw = Math.round(tdee * (1 + delta));
  return Math.max(floor, raw);
}

export function computeEwmaWeight(
  currentWeightKg: number,
  previousSmoothedKg?: number,
  alpha = 0.12
): number {
  if (previousSmoothedKg === undefined || previousSmoothedKg <= 0) {
    return Number(currentWeightKg.toFixed(2));
  }
  const smoothed = alpha * currentWeightKg + (1 - alpha) * previousSmoothedKg;
  return Number(smoothed.toFixed(2));
}

export interface MacroBudgetRemaining {
  remainingCalories: number;
  remainingProteinGrams: number;
  remainingCarbsGrams: number;
  remainingFatGrams: number;
  isCalorieDeficitPreserved: boolean;
  status: 'on_track' | 'approaching_limit' | 'exceeded';
}

export function computeRemainingMacroBudget(
  target: { calories: number; protein: number; carbs: number; fat: number },
  consumed: { calories: number; protein: number; carbs: number; fat: number }
): MacroBudgetRemaining {
  const remainingCalories = Math.max(0, target.calories - consumed.calories);
  const remainingProteinGrams = Math.max(0, Number((target.protein - consumed.protein).toFixed(1)));
  const remainingCarbsGrams = Math.max(0, Number((target.carbs - consumed.carbs).toFixed(1)));
  const remainingFatGrams = Math.max(0, Number((target.fat - consumed.fat).toFixed(1)));

  const ratio = consumed.calories / (target.calories || 1);
  const status = ratio > 1.05 ? 'exceeded' : ratio >= 0.85 ? 'approaching_limit' : 'on_track';

  return {
    remainingCalories,
    remainingProteinGrams,
    remainingCarbsGrams,
    remainingFatGrams,
    isCalorieDeficitPreserved: consumed.calories <= target.calories,
    status,
  };
}
