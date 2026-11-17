import { describe, it, expect } from 'vitest';
import {
  reconcileAtwaterMacros,
  normalizeFoodItem,
  calculateMifflinStJeorBmr,
  calculateTargetCaloriesWithFloor,
  computeEwmaWeight,
} from '../src/utils/atwater.js';
import { round1, formatMacro } from '../src/services/macroMealSolver.js';
import { SEED_INITIAL_MEALS } from '../src/data/mockData.js';

describe('Atwater 4-4-9-7 General Factor Reconciliation Engine', () => {
  it('calculates exact 4-4-9-7 energy deducting dietary fiber from total carbs', () => {
    // 25g P (100) + (30g C - 5g Fiber = 25g Net C -> 100) + 10g F (90) = 290 kcal
    const res = reconcileAtwaterMacros({
      reportedCalories: 290,
      protein: 25,
      carbs: 30,
      fiber: 5,
      fat: 10,
    });
    expect(res.netCarbs).toBe(25);
    expect(res.calculatedCalories).toBe(290);
    expect(res.hasDiscrepancy).toBe(false);
    expect(res.reconciledCalories).toBe(290);
  });

  it('preserves reported calories when within ±10% tolerance window', () => {
    const res = reconcileAtwaterMacros({
      reportedCalories: 305, // ~5.1% above 290
      protein: 25,
      carbs: 30,
      fiber: 5,
      fat: 10,
    });
    expect(res.hasDiscrepancy).toBe(false);
    expect(res.reconciledCalories).toBe(305);
  });

  it('flags Atwater discrepancy when reported calories deviate by >10% and enforces ground-truth', () => {
    const res = reconcileAtwaterMacros({
      reportedCalories: 180, // under-reported label vs 290 calculated
      protein: 25,
      carbs: 30,
      fiber: 5,
      fat: 10,
    });
    expect(res.hasDiscrepancy).toBe(true);
    expect(res.reconciledCalories).toBe(290);
  });

  it('accounts for 7 kcal/g alcohol in Atwater calculation', () => {
    const res = reconcileAtwaterMacros({
      reportedCalories: 0,
      protein: 0,
      carbs: 5,
      fiber: 0,
      fat: 0,
      alcohol: 14, // 14 * 7 = 98 + 20 = 118 kcal
    });
    expect(res.calculatedCalories).toBe(118);
  });

  it('widens calorie confidence interval when cookingFatCategory is unobservable_unknown', () => {
    const item = normalizeFoodItem({
      name: 'Restaurant Dal Makhani',
      protein: 10,
      carbs: 20,
      fat: 12,
      fiber: 4,
      cookingFatCategory: 'unobservable_unknown',
    });
    expect(item.maxCalories - item.minCalories).toBeGreaterThanOrEqual(70);
  });

  it('computes Mifflin-St Jeor BMR and enforces 1,200 female / 1,500 male calorie floors', () => {
    const maleBmr = calculateMifflinStJeorBmr('male', 76.4, 178, 27);
    expect(maleBmr).toBe(1746);
    expect(calculateTargetCaloriesWithFloor(1600, 'male', 'aggressive_cut')).toBe(1500);
    expect(calculateTargetCaloriesWithFloor(1300, 'female', 'aggressive_cut')).toBe(1200);
  });

  it('computes alpha=0.12 exponentially smoothed bodyweight', () => {
    const smoothed = computeEwmaWeight(76.0, 77.0, 0.12);
    // 0.12 * 76 + 0.88 * 77 = 9.12 + 67.76 = 76.88
    expect(smoothed).toBe(76.88);
  });

  it('guarantees pure item reduce consistency across seed meals (reconciling 21 kcal mismatch)', () => {
    const allItems = SEED_INITIAL_MEALS.flatMap((m) => m.items || []);
    const totalCalories = allItems.reduce((sum, item) => sum + (item.calories || 0), 0);
    const totalProtein = Number(allItems.reduce((sum, item) => sum + (item.protein || 0), 0).toFixed(1));
    const totalCarbs = Number(allItems.reduce((sum, item) => sum + (item.carbs || 0), 0).toFixed(1));
    const totalFat = Number(allItems.reduce((sum, item) => sum + (item.fat || 0), 0).toFixed(1));

    // Breakfast (378 kcal) + Lunch (729 kcal) = 1107 kcal, 59.6g P, 84.7g C, 60.8g F
    expect(totalCalories).toBe(1107);
    expect(totalProtein).toBe(59.6);
    expect(Math.round(totalProtein)).toBe(60);
    expect(totalCarbs).toBe(84.7);
    expect(totalFat).toBe(60.8);
  });

  it('verifies round1 and formatMacro prevent floating-point precision leaks', () => {
    // e.g. 14.200000000000003 -> 14.2
    expect(round1(14.200000000000003)).toBe(14.2);
    expect(formatMacro(35.799999999999995)).toBe(35.8);
    expect(round1(0.1 + 0.2)).toBe(0.3);
  });

  it('verifies scaling nutrition items by serving multiplier (1.5x and 2x)', () => {
    const baseItem = {
      grams: 100,
      calories: 200,
      protein: 20,
      carbs: 15,
      fat: 6,
      fiber: 4,
      sugar: 2,
      sodium: 300,
    };

    const scale = (item: typeof baseItem, mult: number) => ({
      grams: Math.round(item.grams * mult),
      calories: Math.round(item.calories * mult),
      protein: round1(item.protein * mult),
      carbs: round1(item.carbs * mult),
      fat: round1(item.fat * mult),
      fiber: round1(item.fiber * mult),
      sugar: round1(item.sugar * mult),
      sodium: Math.round(item.sodium * mult),
    });

    const scaled15 = scale(baseItem, 1.5);
    expect(scaled15.grams).toBe(150);
    expect(scaled15.calories).toBe(300);
    expect(scaled15.protein).toBe(30);
    expect(scaled15.carbs).toBe(22.5);
    expect(scaled15.fat).toBe(9);
    expect(scaled15.fiber).toBe(6);
    expect(scaled15.sugar).toBe(3);
    expect(scaled15.sodium).toBe(450);

    const scaled20 = scale(baseItem, 2);
    expect(scaled20.calories).toBe(400);
    expect(scaled20.protein).toBe(40);
  });
});
