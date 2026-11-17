import { describe, it, expect } from 'vitest';
import {
  computeWeeklyCheckIn,
  normalizeAutopilotGoal,
  calculateTrueTdee,
  computeWeeklyConfidenceScore,
  WeeklyCheckInParams,
} from '../src/services/weeklyAutopilot.js';
import { WeeklyCheckInModal } from '../src/components/WeeklyCheckInModal.js';

describe('Weekly Metabolic Autopilot & Check-In Engine Suite', () => {

  describe('1. Goal Normalization & True TDEE Calculations', () => {
    it('normalizes legacy GoalMode and autopilot strings correctly', () => {
      expect(normalizeAutopilotGoal('aggressive_cut')).toBe('fat_loss');
      expect(normalizeAutopilotGoal('moderate_cut')).toBe('fat_loss');
      expect(normalizeAutopilotGoal('fat_loss')).toBe('fat_loss');
      expect(normalizeAutopilotGoal('lean_bulk')).toBe('lean_gain');
      expect(normalizeAutopilotGoal('lean_gain')).toBe('lean_gain');
      expect(normalizeAutopilotGoal('maintenance')).toBe('maintenance');
      expect(normalizeAutopilotGoal('unknown_mode')).toBe('maintenance');
    });

    it('calculates True TDEE from energy balance formula: ΔWeight_kg * 7700 / 7', () => {
      // 0.5 kg loss in 7 days on 2,000 kcal intake
      // Energy balance = -0.5 * 7700 / 7 = -550 kcal/day
      // True TDEE = 2000 - (-550) = 2550 kcal/day
      const res = calculateTrueTdee(2000, -0.5, 7);
      expect(res.dailyEnergyBalanceKcal).toBe(-550);
      expect(res.trueTdee).toBe(2550);
    });

    it('calculates True TDEE for surplus in 7 days correctly', () => {
      // 0.2 kg gain in 7 days on 2,500 kcal intake
      // Energy balance = +0.2 * 7700 / 7 = +220 kcal/day
      // True TDEE = 2500 - 220 = 2280 kcal/day
      const res = calculateTrueTdee(2500, 0.2, 7);
      expect(res.dailyEnergyBalanceKcal).toBe(220);
      expect(res.trueTdee).toBe(2280);
    });
  });

  describe('2. Fat-Loss Target Calibration', () => {
    it('recommends steady ~500 kcal deficit and 2.2g/kg protein anchor for fat loss', () => {
      const params: WeeklyCheckInParams = {
        goal: 'fat_loss',
        averageDailyIntakeKcal: 2100,
        weightLogs: [
          { date: '2026-11-01', weightKg: 80.0, smoothedWeightKg: 80.0 },
          { date: '2026-11-02', weightKg: 79.9, smoothedWeightKg: 79.98 },
          { date: '2026-11-03', weightKg: 79.7, smoothedWeightKg: 79.92 },
          { date: '2026-11-04', weightKg: 79.8, smoothedWeightKg: 79.89 },
          { date: '2026-11-05', weightKg: 79.6, smoothedWeightKg: 79.81 },
          { date: '2026-11-06', weightKg: 79.5, smoothedWeightKg: 79.72 },
          { date: '2026-11-07', weightKg: 79.3, smoothedWeightKg: 79.52 },
        ],
        currentTargets: {
          calories: 2200,
          protein: 160,
          carbs: 230,
          fat: 70,
        },
        biometrics: {
          gender: 'male',
          weightKg: 79.5,
          heightCm: 180,
          age: 30,
          bmr: 1775,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);

      expect(result.goal).toBe('fat_loss');
      expect(result.smoothedWeightDeltaKg).toBeCloseTo(-0.48, 1);
      expect(result.trueTdee).toBeGreaterThan(2500); // 2100 - (-528) = 2628 kcal
      expect(result.recommendedCalories).toBeLessThanOrEqual(result.trueTdee - 400);
      expect(result.recommendedCalories).toBeGreaterThanOrEqual(result.safetyFloorKcal);

      // Protein target check (2.2 g/kg * ~79.5kg ≈ 175g)
      expect(result.proteinGrams).toBeGreaterThanOrEqual(170);
      expect(result.proteinGrams).toBeLessThanOrEqual(185);

      // Atwater reconciliation check
      const macroCalories = (result.proteinGrams * 4) + (result.carbsGrams * 4) + (result.fatGrams * 9);
      expect(Math.abs(macroCalories - result.recommendedCalories)).toBeLessThanOrEqual(3);

      expect(result.coachReasoning).toContain('Fat Loss');
      expect(result.metabolicConfidenceScore).toBeGreaterThanOrEqual(85);
    });

    it('decelerates deficit if rapid loss (> 0.9 kg/week) is detected to prevent muscle wasting', () => {
      const params: WeeklyCheckInParams = {
        goal: 'fat_loss',
        averageDailyIntakeKcal: 1700,
        weightLogs: [
          { date: '2026-11-01', weightKg: 85.0, smoothedWeightKg: 85.0 },
          { date: '2026-11-02', weightKg: 84.5 },
          { date: '2026-11-03', weightKg: 84.2 },
          { date: '2026-11-04', weightKg: 83.8 },
          { date: '2026-11-05', weightKg: 83.5 },
          { date: '2026-11-06', weightKg: 83.3 },
          { date: '2026-11-07', weightKg: 83.0 },
        ],
        currentTargets: {
          calories: 1800,
          protein: 170,
          carbs: 160,
          fat: 55,
        },
        biometrics: {
          gender: 'male',
          weightKg: 83.0,
          heightCm: 182,
          age: 26,
          bmr: 1830,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);

      expect(result.isRapidLossDetected).toBe(true);
      expect(result.coachReasoning).toContain('Rapid Weight Loss Warning');
      // Deficit is softened and calories are increased safely without exceeding max weekly shift
      expect(result.recommendedCalories).toBeGreaterThan(params.currentTargets.calories);
      expect(result.recommendedCalories).toBeGreaterThanOrEqual(result.trueTdee - 500);
    });
  });

  describe('3. Lean-Gain Calibration', () => {
    it('recommends controlled surplus (+250 kcal) and positive calorie adjustment for lean bulk', () => {
      const params: WeeklyCheckInParams = {
        goal: 'lean_gain',
        averageDailyIntakeKcal: 2500,
        weightLogs: [
          { date: '2026-11-01', weightKg: 72.0, smoothedWeightKg: 72.0 },
          { date: '2026-11-07', weightKg: 72.2, smoothedWeightKg: 72.18 },
        ],
        currentTargets: {
          calories: 2500,
          protein: 150,
          carbs: 310,
          fat: 70,
        },
        biometrics: {
          gender: 'male',
          weightKg: 72.0,
          heightCm: 175,
          age: 24,
          bmr: 1680,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);

      expect(result.goal).toBe('lean_gain');
      expect(result.recommendedCalories).toBeGreaterThan(result.trueTdee);
      expect(result.weeklyDeltaKcal).toBeGreaterThanOrEqual(0);
      expect(result.coachReasoning).toContain('Lean Hypertrophy');
    });
  });

  describe('4. Plateau Detection & Adjustment', () => {
    it('detects weight loss plateau when trend delta is < 0.12 kg and flags refeed rationale', () => {
      const params: WeeklyCheckInParams = {
        goal: 'fat_loss',
        averageDailyIntakeKcal: 2150,
        weightLogs: [
          { date: '2026-11-01', weightKg: 82.0, smoothedWeightKg: 82.0 },
          { date: '2026-11-02', weightKg: 82.05, smoothedWeightKg: 82.01 },
          { date: '2026-11-03', weightKg: 81.98, smoothedWeightKg: 82.0 },
          { date: '2026-11-04', weightKg: 82.02, smoothedWeightKg: 82.0 },
          { date: '2026-11-05', weightKg: 81.95, smoothedWeightKg: 81.99 },
          { date: '2026-11-06', weightKg: 82.01, smoothedWeightKg: 82.0 },
          { date: '2026-11-07', weightKg: 82.03, smoothedWeightKg: 82.0 },
        ],
        currentTargets: {
          calories: 2150,
          protein: 170,
          carbs: 210,
          fat: 70,
        },
        biometrics: {
          gender: 'male',
          weightKg: 82.0,
          heightCm: 178,
          age: 32,
          bmr: 1770,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);

      expect(result.isPlateauDetected).toBe(true);
      expect(Math.abs(result.smoothedWeightDeltaKg)).toBeLessThan(0.12);
      expect(result.coachReasoning).toContain('Metabolic Adaptation / Plateau Flag');
      expect(result.coachReasoning).toContain('Maintenance Refeed');
    });
  });

  describe('5. Physiological Safety Floor Enforcement', () => {
    it('never drops female calories below clinical safety floor (1,200 kcal or BMR)', () => {
      const params: WeeklyCheckInParams = {
        goal: 'fat_loss',
        averageDailyIntakeKcal: 1350,
        weightLogs: [
          { date: '2026-11-01', weightKg: 54.0, smoothedWeightKg: 54.0 },
          { date: '2026-11-07', weightKg: 54.1, smoothedWeightKg: 54.08 },
        ],
        currentTargets: {
          calories: 1300,
          protein: 110,
          carbs: 140,
          fat: 40,
        },
        biometrics: {
          gender: 'female',
          weightKg: 54.0,
          heightCm: 160,
          age: 35,
          bmr: 1240,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);

      // Even if raw math wants to cut 500 kcal from True TDEE (1350 - 100 = 1250 - 500 = 750 kcal)
      expect(result.isSafetyFloorEnforced).toBe(true);
      expect(result.recommendedCalories).toBeGreaterThanOrEqual(1240);
      expect(result.coachReasoning).toContain('Physiological Safety Floor Active');
    });

    it('never cuts more than 750 kcal/day below True TDEE', () => {
      const params: WeeklyCheckInParams = {
        goal: 'fat_loss',
        averageDailyIntakeKcal: 3200,
        weightLogs: [
          { date: '2026-11-01', weightKg: 95.0, smoothedWeightKg: 95.0 },
          { date: '2026-11-07', weightKg: 95.5, smoothedWeightKg: 95.3 },
        ],
        currentTargets: {
          calories: 3200,
          protein: 190,
          carbs: 350,
          fat: 90,
        },
        biometrics: {
          gender: 'male',
          weightKg: 95.0,
          heightCm: 188,
          age: 25,
          bmr: 1980,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);
      const trueTdee = result.trueTdee;

      // Deficit constraint: recommendedCalories >= trueTdee - 750
      expect(result.recommendedCalories).toBeGreaterThanOrEqual(trueTdee - 750);
    });

    it('enforces male safety floor of at least 1500 kcal', () => {
      const params: WeeklyCheckInParams = {
        goal: 'fat_loss',
        averageDailyIntakeKcal: 1600,
        weightLogs: [
          { date: '2026-11-01', weightKg: 65.0, smoothedWeightKg: 65.0 },
          { date: '2026-11-07', weightKg: 65.0, smoothedWeightKg: 65.0 },
        ],
        currentTargets: {
          calories: 1600,
          protein: 140,
          carbs: 160,
          fat: 45,
        },
        biometrics: {
          gender: 'male',
          weightKg: 65.0,
          heightCm: 168,
          age: 40,
          bmr: 1480,
        },
        daysLogged: 7,
      };

      const result = computeWeeklyCheckIn(params);

      expect(result.recommendedCalories).toBeGreaterThanOrEqual(1500);
      expect(result.isSafetyFloorEnforced).toBe(true);
    });
  });

  describe('6. Metabolic Confidence Score Grading', () => {
    it('assigns high confidence score (>= 85%) when all 7 days of weights and nutrition are logged', () => {
      const score = computeWeeklyConfidenceScore(7, 7, 0.4);
      expect(score).toBeGreaterThanOrEqual(85);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('assigns lower confidence score when weight or food logs are sparse', () => {
      const score = computeWeeklyConfidenceScore(2, 2, 0.5);
      expect(score).toBeLessThan(60);
    });
  });

  describe('7. Component Instantiation & Contract Verification', () => {
    it('exports WeeklyCheckInModal React component cleanly', () => {
      expect(WeeklyCheckInModal).toBeDefined();
      expect(typeof WeeklyCheckInModal).toBe('function');
    });
  });

});
