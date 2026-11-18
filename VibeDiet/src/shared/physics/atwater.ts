import { CookingFatCategory, EvidenceTier, FoodItemEntry } from '../../types/index.js';

export interface AtwaterInput {
  reportedCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  alcohol?: number;
  cookingFatCategory?: CookingFatCategory;
  tier?: EvidenceTier;
}

export interface AtwaterReconciliationResult {
  reportedCalories: number;
  calculatedCalories: number;
  reconciledCalories: number;
  netCarbs: number;
  discrepancyRatio: number;
  hasDiscrepancy: boolean;
  minCalories: number;
  maxCalories: number;
}

/**
 * Calculates energy using the Atwater General Factor System:
 * Energy (kcal) = 4 * Protein + 4 * max(0, Carbs - Fiber) + 9 * Fat + 7 * Alcohol
 * Tolerance window: ±10%. If reported calories deviate by >10%, flags discrepancy
 * and adopts the Atwater calculated value as scientific ground truth.
 */
export function reconcileAtwaterMacros(input: AtwaterInput): AtwaterReconciliationResult {
  const protein = Math.max(0, Number(input.protein) || 0);
  const carbs = Math.max(0, Number(input.carbs) || 0);
  const fiber = Math.max(0, Number(input.fiber) || 0);
  const fat = Math.max(0, Number(input.fat) || 0);
  const alcohol = Math.max(0, Number(input.alcohol) || 0);
  const reported = Math.max(0, Math.round(Number(input.reportedCalories) || 0));

  const netCarbs = Math.max(0, carbs - fiber);
  const rawCalculated = (4 * protein) + (4 * netCarbs) + (9 * fat) + (7 * alcohol);
  const calculatedCalories = Math.round(rawCalculated);

  const denominator = Math.max(1, calculatedCalories);
  const discrepancyRatio = reported > 0 ? Math.abs(reported - calculatedCalories) / denominator : 0;

  // Tolerance is ±10% (0.10)
  const hasDiscrepancy = reported > 0 && discrepancyRatio > 0.10;
  const reconciledCalories = (reported === 0 || hasDiscrepancy) ? calculatedCalories : reported;

  // Uncertainty bounds based on tier and cooking fat observability
  const fatCategory = input.cookingFatCategory || 'observable_low';
  let spreadPct = 0.06; // default ±6% for Tier 1/2
  if (input.tier === 3) spreadPct = 0.12;
  if (input.tier === 4) spreadPct = 0.18;
  if (fatCategory === 'observable_moderate') spreadPct = Math.max(spreadPct, 0.12);
  if (fatCategory === 'unobservable_unknown') spreadPct = Math.max(spreadPct, 0.20);

  const minCalories = Math.max(0, Math.round(reconciledCalories * (1 - spreadPct)));
  const maxCalories = Math.round(reconciledCalories * (1 + spreadPct));

  return {
    reportedCalories: reported || calculatedCalories,
    calculatedCalories,
    reconciledCalories,
    netCarbs: Number(netCarbs.toFixed(1)),
    discrepancyRatio: Number(discrepancyRatio.toFixed(4)),
    hasDiscrepancy,
    minCalories,
    maxCalories,
  };
}

/**
 * Returns YYYY-MM-DD in the user's local timezone (not UTC midnight).
 */
export function getLocalDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA');
}

export function normalizeFoodItem(raw: Partial<FoodItemEntry> & { name: string }): FoodItemEntry {
  const tier: EvidenceTier = (raw.tier as EvidenceTier) || 3;
  const cookingFatCategory: CookingFatCategory = raw.cookingFatCategory || 'observable_low';
  const recon = reconcileAtwaterMacros({
    reportedCalories: raw.reportedCalories ?? raw.calories ?? 0,
    protein: raw.protein ?? 0,
    carbs: raw.carbs ?? 0,
    fat: raw.fat ?? 0,
    fiber: raw.fiber ?? 0,
    alcohol: raw.alcohol ?? 0,
    cookingFatCategory,
    tier,
  });

  const defaultConfidence = tier === 1 ? 0.98 : tier === 2 ? 0.93 : tier === 3 ? 0.81 : 0.65;
  const defaultSource =
    tier === 1
      ? 'USDA FoodData Central'
      : tier === 2
      ? 'Open Food Facts Barcode'
      : tier === 3
      ? 'Gemini 2.5 Flash'
      : 'User Estimate';

  const calories = raw.calories !== undefined ? Math.round(raw.calories) : recon.reconciledCalories;
  let minCalories = raw.minCalories ?? recon.minCalories;
  let maxCalories = raw.maxCalories ?? recon.maxCalories;
  if (minCalories > calories || maxCalories < calories) {
    minCalories = recon.minCalories;
    maxCalories = recon.maxCalories;
  }
  minCalories = Math.min(minCalories, calories);
  maxCalories = Math.max(maxCalories, calories);

  return {
    id: raw.id || `item-${Math.random().toString(36).slice(2, 9)}`,
    name: raw.name,
    grams: Math.max(1, Math.round(raw.grams || 100)),
    tier,
    tierSource: raw.tierSource || defaultSource,
    confidence: raw.confidence ?? defaultConfidence,
    reportedCalories: recon.reportedCalories,
    calculatedCalories: recon.calculatedCalories,
    calories,
    minCalories,
    maxCalories,
    protein: Number((raw.protein || 0).toFixed(1)),
    carbs: Number((raw.carbs || 0).toFixed(1)),
    fat: Number((raw.fat || 0).toFixed(1)),
    fiber: Number((raw.fiber || 0).toFixed(1)),
    sugar: Number((raw.sugar || 0).toFixed(1)),
    sodium: Math.round(raw.sodium || 0),
    alcohol: raw.alcohol ? Number(raw.alcohol.toFixed(1)) : 0,
    hasAtwaterDiscrepancy: recon.hasDiscrepancy,
    cookingFatCategory,
    fdcId: raw.fdcId,
    barcode: raw.barcode,
    volumeCm3: raw.volumeCm3,
    densityGPerCm3: raw.densityGPerCm3,
    referenceAnchor: raw.referenceAnchor,
  };
}

/**
 * Returns local calendar date key in YYYY-MM-DD format (immune to UTC midnight shifts).
 */
export function dateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface MacroSplitRatio {
  proteinPct?: number; // e.g. 0.30 or 30
  carbPct?: number;    // e.g. 0.44 or 44
  fatPct?: number;     // e.g. 0.26 or 26
}

export interface DerivedMacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Deterministically derives macro targets (g) from a daily calorie target and macro split
 * such that 4 * protein + 4 * carbs + 9 * fat === calorieTarget (exact 0-kcal discrepancy).
 */
export function deriveTargets(
  calorieTarget: number,
  split: MacroSplitRatio = {}
): DerivedMacroTargets {
  const calories = Math.max(400, Math.round(Number(calorieTarget) || 2245));
  const norm = (val: number | undefined, fallback: number) => {
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return fallback;
    return val > 1 ? val / 100 : val;
  };

  let pPct = norm(split.proteinPct, 0.30);
  let fPct = norm(split.fatPct, 0.26);
  let cPct = norm(split.carbPct, Math.max(0.1, 1 - pPct - fPct));
  const sumPct = pPct + cPct + fPct;
  pPct /= sumPct;
  fPct /= sumPct;

  // Choose integer fat grams congruent to (calories mod 4) so (calories - 9 * fat) is divisible by 4
  const targetMod4 = ((calories % 4) + 4) % 4;
  const rawFat = Math.max(12, Math.round((calories * fPct) / 9));
  let bestFat = rawFat;
  let bestDiff = Infinity;
  for (let delta = -3; delta <= 3; delta++) {
    const candidate = rawFat + delta;
    if (candidate >= 8 && candidate * 9 < calories - 160 && ((candidate % 4) + 4) % 4 === targetMod4) {
      if (Math.abs(delta) < bestDiff) {
        bestDiff = Math.abs(delta);
        bestFat = candidate;
      }
    }
  }
  const fat = bestFat;
  const remainingForPC = calories - fat * 9;
  const maxProtein = Math.floor(remainingForPC / 4) - 10;
  const protein = Math.max(20, Math.min(maxProtein, Math.round((calories * pPct) / 4)));
  const carbs = Math.round((remainingForPC - protein * 4) / 4);

  return { calories, protein, carbs, fat };
}
