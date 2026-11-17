import { describe, it, expect } from 'vitest';
import { solveMacroGap, SOLVER_FOOD_CATALOG } from '../src/services/macroMealSolver.js';

describe('Stream 3: UX Velocity & Smart Macro Solver', () => {
  it('solves remaining macro gaps deterministically without overshooting calories', () => {
    const budget = {
      remainingKcal: 550,
      remainingProtein: 45,
      remainingCarbs: 50,
      remainingFat: 15,
    };

    const combos = solveMacroGap(budget);

    expect(combos).toHaveLength(3);

    // Combo 1: Lean protein power refuel
    const combo1 = combos[0];
    expect(combo1.archetype).toBe('lean_protein');
    expect(combo1.totalCalories).toBeGreaterThan(250);
    expect(combo1.totalCalories).toBeLessThanOrEqual(650);
    expect(combo1.totalProtein).toBeGreaterThanOrEqual(30);
    expect(combo1.proteinMatchPct).toBeGreaterThan(60);

    // Combo 2: Balanced plate
    const combo2 = combos[1];
    expect(combo2.archetype).toBe('balanced_plate');
    expect(combo2.items.some((i) => i.name.includes('Dal'))).toBe(true);
    expect(combo2.totalCalories).toBeGreaterThan(250);

    // Combo 3: Sustained satiety
    const combo3 = combos[2];
    expect(combo3.archetype).toBe('sustained_satiety');
    expect(combo3.totalFiber).toBeGreaterThan(0);
  });

  it('handles zero or negative remaining budget gracefully with minimum floor recovery combos', () => {
    const budget = {
      remainingKcal: 0,
      remainingProtein: 0,
      remainingCarbs: 0,
      remainingFat: 0,
    };

    const combos = solveMacroGap(budget);
    expect(combos).toHaveLength(3);
    expect(combos[0].proteinMatchPct).toBeGreaterThanOrEqual(90);
    expect(combos[0].totalCalories).toBeGreaterThan(0);
  });

  it('contains verified USDA/IFCT food candidates in catalog', () => {
    expect(SOLVER_FOOD_CATALOG.length).toBeGreaterThanOrEqual(8);
    const chicken = SOLVER_FOOD_CATALOG.find((c) => c.id === 'food-chicken-breast');
    expect(chicken).toBeDefined();
    expect(chicken?.proteinPer100g).toBe(31.0);
    expect(chicken?.tierSource).toContain('USDA');
  });
});
