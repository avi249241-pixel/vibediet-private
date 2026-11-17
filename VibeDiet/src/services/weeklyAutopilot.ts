import {
  calculateMifflinStJeorBmr,
  computeEwmaWeight,
} from '../utils/atwater.js';
import { ActivityLevel, GoalMode, UserBiometrics, WeightLogEntry } from '../types/index.js';

export type AutopilotGoal = 'fat_loss' | 'maintenance' | 'lean_gain';

export interface WeeklyWeightRecord {
  date: string;
  weightKg: number;
  smoothedWeightKg?: number;
}

export interface WeeklyCheckInParams {
  goal: AutopilotGoal | GoalMode;
  weightLogs: (WeeklyWeightRecord | WeightLogEntry)[];
  averageDailyIntakeKcal: number;
  currentTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  biometrics: {
    gender: 'male' | 'female';
    weightKg: number;
    heightCm: number;
    age: number;
    bmr?: number;
    bodyFatPct?: number;
    activityLevel?: ActivityLevel;
  };
  alpha?: number; // default: 0.12
  daysLogged?: number; // default: 7
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeeklyCheckInResult {
  goal: AutopilotGoal;
  recommendedCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  weeklyDeltaKcal: number;
  trueTdee: number;
  dailyEnergyBalanceKcal: number;
  smoothedWeightDeltaKg: number;
  rawWeightDeltaKg: number;
  startSmoothedWeightKg: number;
  endSmoothedWeightKg: number;
  metabolicConfidenceScore: number; // 0 - 100
  isPlateauDetected: boolean;
  isRapidLossDetected: boolean;
  isSafetyFloorEnforced: boolean;
  safetyFloorKcal: number;
  coachReasoning: string;
  previousTargets: MacroTargets;
}

/**
 * Normalizes various goal representations (including legacy GoalMode)
 * into the 3 core metabolic autopilot archetypes.
 */
export function normalizeAutopilotGoal(goal: AutopilotGoal | GoalMode | string): AutopilotGoal {
  switch (goal) {
    case 'aggressive_cut':
    case 'moderate_cut':
    case 'fat_loss':
      return 'fat_loss';
    case 'lean_bulk':
    case 'lean_gain':
      return 'lean_gain';
    case 'maintenance':
    default:
      return 'maintenance';
  }
}

/**
 * Calculates True Expended Energy (True TDEE) from intake and smoothed weight delta.
 * Formula: Daily Balance = (ΔWeight_kg * 7700 kcal/kg) / days
 * True TDEE = Average Intake - Daily Balance
 */
export function calculateTrueTdee(
  averageIntakeKcal: number,
  smoothedWeightDeltaKg: number,
  days = 7
): { trueTdee: number; dailyEnergyBalanceKcal: number } {
  const safeDays = Math.max(1, days);
  // Total energy change = deltaKg * 7700 kcal
  const dailyEnergyBalanceKcal = Math.round((smoothedWeightDeltaKg * 7700) / safeDays);
  const trueTdee = Math.round(averageIntakeKcal - dailyEnergyBalanceKcal);

  return {
    trueTdee: Math.max(800, trueTdee),
    dailyEnergyBalanceKcal,
  };
}

/**
 * Calculates metabolic confidence score (0-100%) based on weight log density,
 * nutrition intake consistency, and trend reliability.
 */
export function computeWeeklyConfidenceScore(
  weightLogCount: number,
  daysLogged = 7,
  weightDeltaAbs = 0
): number {
  // Up to 50 points for weight logging frequency (7 logs = 50 pts)
  const weightScore = (Math.min(7, Math.max(0, weightLogCount)) / 7) * 50;
  // Up to 35 points for calorie intake logging (7 logged days = 35 pts)
  const intakeScore = (Math.min(7, Math.max(0, daysLogged)) / 7) * 35;
  // Up to 15 points for reasonable biological rate of change
  const stabilityScore = weightDeltaAbs <= 1.2 ? 15 : Math.max(5, 15 - (weightDeltaAbs - 1.2) * 10);

  return Math.round(Math.min(100, Math.max(20, weightScore + intakeScore + stabilityScore)));
}

/**
 * Core Deterministic Weekly TDEE & Macro Autopilot Engine.
 * Evaluates 7-day smoothed EWMA weight changes, determines True TDEE,
 * applies goal-specific caloric offsets, enforces strict clinical safety floors,
 * and partitions macros to the exact Atwater gram.
 */
export function computeWeeklyCheckIn(params: WeeklyCheckInParams): WeeklyCheckInResult {
  const goal = normalizeAutopilotGoal(params.goal);
  const alpha = params.alpha ?? 0.12;

  // 1. Sort weight logs chronologically
  const sortedLogs = [...params.weightLogs].sort((a, b) => a.date.localeCompare(b.date));

  // 2. Compute EWMA smoothed weights across the series
  // If smoothedWeightKg is provided on entries (from continuous tracking), prioritize it.
  let smoothed = sortedLogs[0]?.smoothedWeightKg ?? sortedLogs[0]?.weightKg ?? params.biometrics.weightKg;
  const smoothedSeries: number[] = [];

  for (let i = 0; i < sortedLogs.length; i++) {
    const raw = sortedLogs[i].weightKg;
    if (sortedLogs[i].smoothedWeightKg !== undefined && sortedLogs[i].smoothedWeightKg! > 0) {
      smoothed = sortedLogs[i].smoothedWeightKg!;
    } else {
      smoothed = i === 0 ? raw : computeEwmaWeight(raw, smoothed, alpha);
    }
    smoothedSeries.push(smoothed);
  }

  const startSmoothedWeightKg = smoothedSeries[0] ?? params.biometrics.weightKg;
  const endSmoothedWeightKg = smoothedSeries[smoothedSeries.length - 1] ?? params.biometrics.weightKg;
  const smoothedWeightDeltaKg = Number((endSmoothedWeightKg - startSmoothedWeightKg).toFixed(2));

  const startRawWeight = sortedLogs[0]?.weightKg ?? params.biometrics.weightKg;
  const endRawWeight = sortedLogs[sortedLogs.length - 1]?.weightKg ?? params.biometrics.weightKg;
  const rawWeightDeltaKg = Number((endRawWeight - startRawWeight).toFixed(2));

  // 3. Determine True TDEE & Energy Balance using standard 7-day calibration window
  let calibrationDays = 7;
  if (sortedLogs.length >= 2) {
    const d0 = new Date(sortedLogs[0].date).getTime();
    const dN = new Date(sortedLogs[sortedLogs.length - 1].date).getTime();
    const diff = Math.round(Math.abs(dN - d0) / (1000 * 60 * 60 * 24));
    if (diff >= 3 && diff <= 14) {
      calibrationDays = diff;
    }
  }

  const { trueTdee, dailyEnergyBalanceKcal } = calculateTrueTdee(
    params.averageDailyIntakeKcal,
    smoothedWeightDeltaKg,
    calibrationDays
  );

  // 4. Calculate Physiological Safety Floors
  // Gender minimum: Male 1500 kcal, Female 1200 kcal
  const genderFloor = params.biometrics.gender === 'male' ? 1500 : 1200;

  // Mifflin-St Jeor Basal Metabolic Rate
  const calculatedBmr = calculateMifflinStJeorBmr(
    params.biometrics.gender,
    endSmoothedWeightKg,
    params.biometrics.heightCm,
    params.biometrics.age
  );
  const bmrFloor = params.biometrics.bmr && params.biometrics.bmr > 500
    ? params.biometrics.bmr
    : calculatedBmr;

  // Safety floor cannot drop below BMR or gender floor
  const safetyFloorKcal = Math.max(genderFloor, bmrFloor);

  // Maximum deficit rule: never cut more than 750 kcal/day below True TDEE
  const maxDeficitFloor = trueTdee - 750;
  const absoluteMinimumFloor = Math.max(safetyFloorKcal, maxDeficitFloor);

  // 5. Detect Plateau or Rapid Loss conditions
  // Plateau: Cutting goal, but weight changed by less than 0.12 kg over the week
  const isPlateauDetected =
    goal === 'fat_loss' &&
    Math.abs(smoothedWeightDeltaKg) < 0.12 &&
    sortedLogs.length >= 3;

  // Rapid Loss: Dropped more than 0.85 kg smoothed or 1.4 kg raw in one week (muscle wasting risk)
  const isRapidLossDetected =
    goal === 'fat_loss' &&
    (smoothedWeightDeltaKg < -0.85 || rawWeightDeltaKg < -1.4) &&
    sortedLogs.length >= 3;

  // 6. Compute Goal-Specific Target Calories
  let rawRecommendedCalories: number;

  switch (goal) {
    case 'fat_loss': {
      if (isRapidLossDetected) {
        // Losing too fast: ease the deficit to preserve lean mass (-300 kcal vs -500 kcal)
        rawRecommendedCalories = trueTdee - 300;
      } else if (isPlateauDetected) {
        // In a plateau: if already near floor, maintain and schedule refeed; else adjust down 100 kcal
        if (params.currentTargets.calories <= absoluteMinimumFloor + 100) {
          rawRecommendedCalories = absoluteMinimumFloor;
        } else {
          rawRecommendedCalories = Math.max(
            absoluteMinimumFloor,
            params.currentTargets.calories - 100
          );
        }
      } else {
        // Standard sustainable fat loss deficit: ~500 kcal/day (aiming for ~0.45-0.5 kg/week)
        rawRecommendedCalories = trueTdee - 500;
      }
      break;
    }

    case 'lean_gain': {
      // Aim for +0.20 to +0.35 kg/week lean mass gain
      if (smoothedWeightDeltaKg > 0.45) {
        // Gaining too fast (fat accrual risk): trim surplus to +150 kcal
        rawRecommendedCalories = trueTdee + 150;
      } else if (smoothedWeightDeltaKg < 0.05) {
        // Not gaining enough: bump surplus to +350 kcal
        rawRecommendedCalories = trueTdee + 350;
      } else {
        // Healthy lean gain surplus: +250 kcal/day
        rawRecommendedCalories = trueTdee + 250;
      }
      break;
    }

    case 'maintenance':
    default: {
      // Re-center around True TDEE with minor fine-tuning
      if (smoothedWeightDeltaKg > 0.25) {
        rawRecommendedCalories = trueTdee - 100;
      } else if (smoothedWeightDeltaKg < -0.25) {
        rawRecommendedCalories = trueTdee + 100;
      } else {
        rawRecommendedCalories = trueTdee;
      }
      break;
    }
  }

  // 7. Enforce Safety Floors & Maximum Deficit Constraints
  let recommendedCalories = Math.round(rawRecommendedCalories);
  let isSafetyFloorEnforced = false;

  if (recommendedCalories < absoluteMinimumFloor) {
    recommendedCalories = absoluteMinimumFloor;
    isSafetyFloorEnforced = true;
  }

  // Prevent extreme single-week shifts (> 400 kcal) unless mandated by safety floor
  const maxWeeklyShift = 400;
  const currentKcal = params.currentTargets.calories || recommendedCalories;
  const rawShift = recommendedCalories - currentKcal;

  if (!isSafetyFloorEnforced) {
    if (rawShift > maxWeeklyShift) {
      recommendedCalories = currentKcal + maxWeeklyShift;
    } else if (rawShift < -maxWeeklyShift) {
      recommendedCalories = currentKcal - maxWeeklyShift;
    }
  }

  // Final re-verification against absolute minimum floor
  if (recommendedCalories < absoluteMinimumFloor) {
    recommendedCalories = absoluteMinimumFloor;
    isSafetyFloorEnforced = true;
  }

  // 8. Partition Macronutrients to Exact Atwater Grams
  // Protein: High protein to protect lean mass (2.2 g/kg for cut, 2.0 g/kg for gain/maintenance)
  const proteinMultiplier = goal === 'fat_loss' ? 2.2 : 2.0;
  const targetWeight = endSmoothedWeightKg || params.biometrics.weightKg;
  const proteinGrams = Math.round(
    Math.min(260, Math.max(100, targetWeight * proteinMultiplier))
  );
  const proteinKcal = proteinGrams * 4;

  // Fat: Essential hormonal baseline (0.85 g/kg or minimum 22% of total calories)
  const minFatFromWeight = Math.round(targetWeight * 0.85);
  const minFatFromKcal = Math.round((recommendedCalories * 0.22) / 9);
  const fatGrams = Math.max(minFatFromWeight, minFatFromKcal);
  const fatKcal = fatGrams * 9;

  // Carbs: Remaining caloric budget
  const remainingKcal = Math.max(120, recommendedCalories - (proteinKcal + fatKcal));
  let carbsGrams = Math.round(remainingKcal / 4);

  // Exact Atwater 4-4-9 reconciliation
  const calculatedSum = (proteinGrams * 4) + (carbsGrams * 4) + (fatGrams * 9);
  const diff = recommendedCalories - calculatedSum;
  if (diff !== 0) {
    carbsGrams = Math.max(30, carbsGrams + Math.round(diff / 4));
  }

  const weeklyDeltaKcal = recommendedCalories - (params.currentTargets.calories || recommendedCalories);
  const confidenceScore = computeWeeklyConfidenceScore(
    sortedLogs.length,
    params.daysLogged ?? 7,
    Math.abs(smoothedWeightDeltaKg)
  );

  // 9. Generate Plain-English Coach Reasoning
  const coachReasoning = buildCoachReasoning({
    goal,
    smoothedWeightDeltaKg,
    averageIntake: params.averageDailyIntakeKcal,
    trueTdee,
    recommendedCalories,
    weeklyDeltaKcal,
    isPlateauDetected,
    isRapidLossDetected,
    isSafetyFloorEnforced,
    safetyFloorKcal: absoluteMinimumFloor,
    proteinGrams,
    gender: params.biometrics.gender,
  });

  return {
    goal,
    recommendedCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    weeklyDeltaKcal,
    trueTdee,
    dailyEnergyBalanceKcal,
    smoothedWeightDeltaKg,
    rawWeightDeltaKg,
    startSmoothedWeightKg,
    endSmoothedWeightKg,
    metabolicConfidenceScore: confidenceScore,
    isPlateauDetected,
    isRapidLossDetected,
    isSafetyFloorEnforced,
    safetyFloorKcal: absoluteMinimumFloor,
    coachReasoning,
    previousTargets: { ...params.currentTargets },
  };
}

interface ReasoningArgs {
  goal: AutopilotGoal;
  smoothedWeightDeltaKg: number;
  averageIntake: number;
  trueTdee: number;
  recommendedCalories: number;
  weeklyDeltaKcal: number;
  isPlateauDetected: boolean;
  isRapidLossDetected: boolean;
  isSafetyFloorEnforced: boolean;
  safetyFloorKcal: number;
  proteinGrams: number;
  gender: 'male' | 'female';
}

function buildCoachReasoning(args: ReasoningArgs): string {
  const deltaText = args.smoothedWeightDeltaKg >= 0
    ? `+${args.smoothedWeightDeltaKg} kg`
    : `${args.smoothedWeightDeltaKg} kg`;

  const deltaKcalText = args.weeklyDeltaKcal >= 0
    ? `+${args.weeklyDeltaKcal} kcal/day`
    : `${args.weeklyDeltaKcal} kcal/day`;

  if (args.isSafetyFloorEnforced) {
    return `Physiological Safety Floor Active: Over the past 7 days, your smoothed bodyweight trend shifted by ${deltaText} against an average intake of ${args.averageIntake} kcal/d, yielding a True TDEE of ${args.trueTdee} kcal/d. Although a deeper cut was calculated, your target has been locked at ${args.safetyFloorKcal} kcal/day (${args.gender === 'male' ? '1,500' : '1,200'} kcal gender minimum / BMR threshold). This prevents thyroid downregulation, preserves lean skeletal mass (${args.proteinGrams}g protein target), and avoids metabolic crash.`;
  }

  if (args.isRapidLossDetected) {
    return `Rapid Weight Loss Warning: Your smoothed trend dropped by ${deltaText} over 7 days, which exceeds the clinical ceiling of 0.9 kg/week. To prevent muscle wasting and metabolic adaptation, we reduced your deficit by increasing calories to ${args.recommendedCalories} kcal/day (${deltaKcalText}). Your True Expenditure is strong at ${args.trueTdee} kcal/d.`;
  }

  if (args.isPlateauDetected) {
    return `Metabolic Adaptation / Plateau Flag: Smoothed bodyweight remained virtually flat (${deltaText}) over the 7-day calibration period despite an intake of ${args.averageIntake} kcal/d. Your calibrated True TDEE sits at ${args.trueTdee} kcal/d. Target adjusted to ${args.recommendedCalories} kcal/day (${deltaKcalText}). We also recommend a 2-day Maintenance Refeed (+350 kcal from complex carbs) to stimulate leptin and restore thyroid T3 conversion.`;
  }

  if (args.goal === 'fat_loss') {
    return `Consistent Fat Loss Progress: Your 7-day smoothed bodyweight moved by ${deltaText} on an average intake of ${args.averageIntake} kcal/day, confirming a True Expenditure of ${args.trueTdee} kcal/day. Next week's target is set to ${args.recommendedCalories} kcal/day (${deltaKcalText}) with an optimal 2.2g/kg protein anchor (${args.proteinGrams}g) to maintain a steady ~0.45 kg/week fat-loss trajectory.`;
  }

  if (args.goal === 'lean_gain') {
    return `Lean Hypertrophy Calibration: Smoothed trend moved by ${deltaText} with an average intake of ${args.averageIntake} kcal/day (True TDEE: ${args.trueTdee} kcal/day). Target updated to ${args.recommendedCalories} kcal/day (${deltaKcalText}) to deliver a controlled ~250 kcal surplus, prioritizing muscle protein synthesis over fat deposition.`;
  }

  return `Metabolic Homeostasis Maintained: Your smoothed weight changed by ${deltaText} over the week. Calibrated True TDEE is ${args.trueTdee} kcal/day. Next week's maintenance target is set to ${args.recommendedCalories} kcal/day (${deltaKcalText}) to keep energy balance neutral.`;
}
