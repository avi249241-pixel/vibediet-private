import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FoodItemEntry, MealSlot } from '../types/index.js';
import { normalizeFoodItem } from '../utils/atwater.js';
import { COLOR_TOKENS, SPRING_PRESETS } from '../client/design-system/tokens.js';
import { getAllPortionCalibrations } from './portionMemory.js';

export function round1(val: number): number {
  return Number((Math.round(val * 10) / 10).toFixed(1));
}

export function formatMacro(val: number): number {
  return round1(val);
}

export interface SolverFoodCandidate {
  id: string;
  name: string;
  defaultGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sugarPer100g?: number;
  sodiumPer100g?: number;
  category: 'lean_protein' | 'complex_carb' | 'healthy_fat' | 'veg_fiber';
  tierSource: string;
}

export interface MacroGapBudget {
  remainingKcal: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
}

export interface SolvedMealCombo {
  id: string;
  title: string;
  archetype: 'lean_protein' | 'balanced_plate' | 'sustained_satiety';
  badge: string;
  explanation: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  proteinMatchPct: number;
  calorieFitPct: number;
  items: FoodItemEntry[];
}

export const SOLVER_FOOD_CATALOG: SolverFoodCandidate[] = [
  {
    id: 'food-chicken-breast',
    name: 'Grilled Chicken Breast, Skinless',
    defaultGrams: 140,
    caloriesPer100g: 165,
    proteinPer100g: 31.0,
    carbsPer100g: 0.0,
    fatPer100g: 3.6,
    fiberPer100g: 0.0,
    category: 'lean_protein',
    tierSource: 'USDA FoodData Central #171477',
  },
  {
    id: 'food-greek-yogurt',
    name: 'Greek Yogurt, Non-Fat Natural',
    defaultGrams: 170,
    caloriesPer100g: 59,
    proteinPer100g: 10.0,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    fiberPer100g: 0.0,
    category: 'lean_protein',
    tierSource: 'USDA FoodData Central #171304',
  },
  {
    id: 'food-egg-whites',
    name: 'Boiled Egg Whites (Grade A Large)',
    defaultGrams: 130,
    caloriesPer100g: 52,
    proteinPer100g: 10.9,
    carbsPer100g: 0.7,
    fatPer100g: 0.2,
    fiberPer100g: 0.0,
    category: 'lean_protein',
    tierSource: 'USDA FoodData Central #171287',
  },
  {
    id: 'food-fresh-paneer',
    name: 'Fresh Paneer (Indian Cottage Cheese)',
    defaultGrams: 100,
    caloriesPer100g: 296,
    proteinPer100g: 18.3,
    carbsPer100g: 3.4,
    fatPer100g: 22.8,
    fiberPer100g: 0.0,
    category: 'lean_protein',
    tierSource: 'USDA FoodData Central #746782',
  },
  {
    id: 'food-yellow-dal',
    name: 'Dal Tadka (Yellow Moong & Toor)',
    defaultGrams: 150,
    caloriesPer100g: 94,
    proteinPer100g: 6.0,
    carbsPer100g: 13.5,
    fatPer100g: 3.3,
    fiberPer100g: 3.2,
    category: 'complex_carb',
    tierSource: 'IFCT / USDA #1102901',
  },
  {
    id: 'food-basmati-rice',
    name: 'Basmati Rice, Steamed',
    defaultGrams: 140,
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    fiberPer100g: 0.4,
    category: 'complex_carb',
    tierSource: 'USDA FoodData Central #169756',
  },
  {
    id: 'food-phulka-roti',
    name: 'Whole Wheat Phulka Roti',
    defaultGrams: 70,
    caloriesPer100g: 250,
    proteinPer100g: 8.5,
    carbsPer100g: 48.0,
    fatPer100g: 2.2,
    fiberPer100g: 7.0,
    category: 'complex_carb',
    tierSource: 'IFCT / USDA #1102902',
  },
  {
    id: 'food-kachumber-salad',
    name: 'Kachumber Salad (Cucumber, Tomato, Lemon)',
    defaultGrams: 120,
    caloriesPer100g: 24,
    proteinPer100g: 1.1,
    carbsPer100g: 4.8,
    fatPer100g: 0.2,
    fiberPer100g: 1.8,
    category: 'veg_fiber',
    tierSource: 'USDA FoodData Central #169228',
  },
  {
    id: 'food-hass-avocado',
    name: 'Hass Avocado, Sliced',
    defaultGrams: 60,
    caloriesPer100g: 160,
    proteinPer100g: 2.0,
    carbsPer100g: 8.5,
    fatPer100g: 14.7,
    fiberPer100g: 6.7,
    category: 'healthy_fat',
    tierSource: 'USDA FoodData Central #171705',
  },
  {
    id: 'food-desi-ghee',
    name: 'Pure Desi Cow Ghee',
    defaultGrams: 6,
    caloriesPer100g: 884,
    proteinPer100g: 0.0,
    carbsPer100g: 0.0,
    fatPer100g: 99.5,
    fiberPer100g: 0.0,
    category: 'healthy_fat',
    tierSource: 'USDA FoodData Central #171314',
  },
];

function scaleCandidate(c: SolverFoodCandidate, grams: number): FoodItemEntry {
  const factor = Math.max(0.1, grams) / 100;
  return normalizeFoodItem({
    id: `solver-${c.id}-${Math.round(grams)}g`,
    name: c.name,
    grams: Math.round(grams),
    tier: 1,
    tierSource: c.tierSource,
    confidence: 0.98,
    reportedCalories: Math.round(c.caloriesPer100g * factor),
    protein: Number((c.proteinPer100g * factor).toFixed(1)),
    carbs: Number((c.carbsPer100g * factor).toFixed(1)),
    fat: Number((c.fatPer100g * factor).toFixed(1)),
    fiber: Number((c.fiberPer100g * factor).toFixed(1)),
    sugar: Number(((c.sugarPer100g ?? 1.0) * factor).toFixed(1)),
    sodium: Math.round((c.sodiumPer100g ?? 45) * factor),
    cookingFatCategory: 'observable_low',
  });
}

/**
 * Deterministic Macro Gap Solver:
 * Generates 3 scientifically structured meal combos tailored to close today's macro gap.
 */
export function solveMacroGap(budget: MacroGapBudget, userUid?: string): SolvedMealCombo[] {
  const { remainingKcal, remainingProtein, remainingCarbs, remainingFat } = budget;

  // Effective budget clamp for a single meal session
  const targetKcal = Math.max(250, Math.min(850, remainingKcal > 0 ? remainingKcal : 450));
  const targetProtein = Math.max(15, Math.min(65, remainingProtein > 0 ? remainingProtein : 35));

  // Check personal portion memory for user preferences
  let calibratedPortions: Record<string, number> = {};
  if (userUid) {
    try {
      const cals = getAllPortionCalibrations(userUid);
      cals.forEach((c) => {
        calibratedPortions[c.foodKey] = c.calibratedGrams;
      });
    } catch {}
  }

  // --- COMBO 1: High-Protein Lean Refuel ---
  // Ideal when protein is behind or calories are tight
  const chickenGrams = Math.round(Math.max(80, Math.min(220, (targetProtein * 0.75 / 0.31))));
  const yogurtGrams = 150;
  const saladGrams = 100;
  const combo1Items = [
    scaleCandidate(SOLVER_FOOD_CATALOG[0], chickenGrams), // Chicken
    scaleCandidate(SOLVER_FOOD_CATALOG[1], yogurtGrams),  // Greek yogurt
    scaleCandidate(SOLVER_FOOD_CATALOG[7], saladGrams),   // Salad
  ];
  const c1Cal = combo1Items.reduce((s, i) => s + i.calories, 0);
  const c1Prot = combo1Items.reduce((s, i) => s + i.protein, 0);
  const c1Carb = combo1Items.reduce((s, i) => s + i.carbs, 0);
  const c1Fat = combo1Items.reduce((s, i) => s + i.fat, 0);
  const c1Fib = combo1Items.reduce((s, i) => s + i.fiber, 0);

  // --- COMBO 2: Balanced Metabolic Recovery Plate ---
  // Proportional balance of clean carbs + moderate protein + essential fats
  const dalGrams = calibratedPortions['dal tadka'] || 160;
  const paneerGrams = calibratedPortions['paneer'] || 90;
  const riceGrams = Math.round(Math.max(70, Math.min(180, (targetKcal * 0.35) / 1.3)));
  const combo2Items = [
    scaleCandidate(SOLVER_FOOD_CATALOG[4], dalGrams),    // Dal Tadka
    scaleCandidate(SOLVER_FOOD_CATALOG[3], paneerGrams), // Fresh Paneer
    scaleCandidate(SOLVER_FOOD_CATALOG[5], riceGrams),   // Basmati Rice
    scaleCandidate(SOLVER_FOOD_CATALOG[9], 5),           // Desi Ghee
  ];
  const c2Cal = combo2Items.reduce((s, i) => s + i.calories, 0);
  const c2Prot = combo2Items.reduce((s, i) => s + i.protein, 0);
  const c2Carb = combo2Items.reduce((s, i) => s + i.carbs, 0);
  const c2Fat = combo2Items.reduce((s, i) => s + i.fat, 0);
  const c2Fib = combo2Items.reduce((s, i) => s + i.fiber, 0);

  // --- COMBO 3: Clean Satiety & High-Fiber Energy ---
  // Emphasizes steady satiety, slow digestion, and micronutrient density
  const eggWhiteGrams = 160;
  const rotiGrams = calibratedPortions['phulka roti'] || 65;
  const avocadoGrams = 50;
  const combo3Items = [
    scaleCandidate(SOLVER_FOOD_CATALOG[2], eggWhiteGrams), // Egg whites
    scaleCandidate(SOLVER_FOOD_CATALOG[6], rotiGrams),     // Phulka Roti
    scaleCandidate(SOLVER_FOOD_CATALOG[8], avocadoGrams),  // Avocado
    scaleCandidate(SOLVER_FOOD_CATALOG[7], 120),           // Kachumber
  ];
  const c3Cal = combo3Items.reduce((s, i) => s + i.calories, 0);
  const c3Prot = combo3Items.reduce((s, i) => s + i.protein, 0);
  const c3Carb = combo3Items.reduce((s, i) => s + i.carbs, 0);
  const c3Fat = combo3Items.reduce((s, i) => s + i.fat, 0);
  const c3Fib = combo3Items.reduce((s, i) => s + i.fiber, 0);

  const calculateProteinMatch = (prot: number) => {
    if (remainingProtein <= 0) return 100;
    return Math.min(100, Math.round((prot / remainingProtein) * 100));
  };

  const calculateCalorieFit = (cal: number) => {
    if (remainingKcal <= 0) return 100;
    const diff = Math.abs(cal - remainingKcal);
    return Math.max(50, Math.min(100, Math.round(100 - (diff / remainingKcal) * 50)));
  };

  return [
    {
      id: 'combo-lean-protein',
      title: 'Lean Protein Power Refuel',
      archetype: 'lean_protein',
      badge: '⚡ Peak Protein / Low Fat',
      explanation: `Delivers ${Math.round(c1Prot)}g protein for only ${c1Cal} kcal. Closes your protein gap with zero heavy oil.`,
      totalCalories: c1Cal,
      totalProtein: Math.round(c1Prot),
      totalCarbs: Math.round(c1Carb),
      totalFat: Math.round(c1Fat),
      totalFiber: Math.round(c1Fib),
      proteinMatchPct: calculateProteinMatch(c1Prot),
      calorieFitPct: calculateCalorieFit(c1Cal),
      items: combo1Items,
    },
    {
      id: 'combo-balanced-plate',
      title: 'Balanced Indian Recovery Thali',
      archetype: 'balanced_plate',
      badge: '🍛 High Satiety & Glycogen',
      explanation: `Harmonious blend of Dal Tadka, Paneer & Basmati Rice. Recharges glycogen while supplying ${Math.round(c2Prot)}g protein.`,
      totalCalories: c2Cal,
      totalProtein: Math.round(c2Prot),
      totalCarbs: Math.round(c2Carb),
      totalFat: Math.round(c2Fat),
      totalFiber: Math.round(c2Fib),
      proteinMatchPct: calculateProteinMatch(c2Prot),
      calorieFitPct: calculateCalorieFit(c2Cal),
      items: combo2Items,
    },
    {
      id: 'combo-sustained-satiety',
      title: 'Clean Fiber & Egg White Refuel',
      archetype: 'sustained_satiety',
      badge: '🥑 Fiber & Healthy Fats',
      explanation: `Egg whites paired with Phulka Roti and avocado healthy fats. Keeps ghrelin suppressed with ${Math.round(c3Fib)}g fiber.`,
      totalCalories: c3Cal,
      totalProtein: Math.round(c3Prot),
      totalCarbs: Math.round(c3Carb),
      totalFat: Math.round(c3Fat),
      totalFiber: Math.round(c3Fib),
      proteinMatchPct: calculateProteinMatch(c3Prot),
      calorieFitPct: calculateCalorieFit(c3Cal),
      items: combo3Items,
    },
  ];
}

/**
 * SmartMacroSolverWidget:
 * Self-contained glass card rendered in MetabolismCoachScreen and DailyDiaryScreen.
 */
interface SmartMacroSolverWidgetProps {
  remainingKcal: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  onLogCombo: (slot: MealSlot, title: string, items: FoodItemEntry[]) => void;
  targetSlot?: MealSlot;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'water') => void;
  hideDuplicateHeader?: boolean;
}

export const SmartMacroSolverWidget: React.FC<SmartMacroSolverWidgetProps> = ({
  remainingKcal,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  onLogCombo,
  targetSlot = 'dinner',
  onShowToast,
  hideDuplicateHeader = false,
}) => {
  const [selectedComboIndex, setSelectedComboIndex] = useState(0);

  const budget: MacroGapBudget = {
    remainingKcal,
    remainingProtein,
    remainingCarbs,
    remainingFat,
  };

  const combos = solveMacroGap(budget);
  const currentCombo = combos[selectedComboIndex] || combos[0];

  const handleApplyCombo = () => {
    onLogCombo(targetSlot, currentCombo.title, currentCombo.items);
    onShowToast?.(`Logged combo: "${currentCombo.title}" to ${targetSlot}`, 'success');
  };

  return (
    <div
      className={
        hideDuplicateHeader
          ? 'space-y-4 select-none relative pt-1'
          : 'apple-card p-5 space-y-4 select-none relative overflow-hidden bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]'
      }
      data-testid="smart-macro-solver-widget"
    >
      {/* Background radial accent glow */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-15"
        style={{
          background: `radial-gradient(circle, #0EA5E9, #FF6B2C)`,
        }}
      />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3.5">
        <div>
          {!hideDuplicateHeader && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">✨</span>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white tracking-tight">
                Smart Macro Solver
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0EA5E9]/15 text-[#0EA5E9] border border-[#0EA5E9]/30">
                Close Today&apos;s Gap
              </span>
            </div>
          )}
          <p className="text-[11px] text-slate-600 dark:text-zinc-400">
            Remaining Target:{' '}
            <strong className="text-[#FF6B2C] font-mono font-bold">{Math.max(0, Math.round(remainingKcal))} kcal</strong> ·{' '}
            <strong className="text-[#0EA5E9] font-mono font-bold">{Math.max(0, formatMacro(remainingProtein))}g P</strong> ·{' '}
            <span className="text-slate-600 dark:text-zinc-400 font-mono">{Math.max(0, formatMacro(remainingCarbs))}g C</span> ·{' '}
            <span className="text-slate-600 dark:text-zinc-400 font-mono">{Math.max(0, formatMacro(remainingFat))}g F</span>
          </p>
        </div>

        {/* 1-Tap Log Combo Button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handleApplyCombo}
          data-testid="log-combo-btn"
          className="px-4 py-2 rounded-xl text-white font-extrabold text-xs tracking-wide transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:brightness-105"
          style={{
            background: `linear-gradient(135deg, #FF6B2C, #FF9248)`,
          }}
        >
          <span>✨</span>
          <span>+ Log Combo ({currentCombo.totalCalories} kcal)</span>
        </motion.button>
      </div>

      {/* 3 Spacious, Non-Overlapping Combo Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {combos.map((combo, idx) => {
          const isSelected = idx === selectedComboIndex;
          return (
            <button
              key={combo.id}
              type="button"
              onClick={() => setSelectedComboIndex(idx)}
              data-testid={`solver-combo-tab-${combo.id}`}
              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                isSelected
                  ? 'bg-[#0EA5E9]/10 border-[#0EA5E9]/40 shadow-sm ring-1 ring-[#0EA5E9]/20'
                  : 'apple-subcard bg-slate-50 hover:bg-slate-100/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border-slate-900/[0.06] dark:border-white/[0.06] text-slate-600 dark:text-zinc-400'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold truncate text-[#0F172A] dark:text-white">{combo.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-mono font-bold text-[#FF6B2C]">
                  {combo.totalCalories} kcal
                </span>
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-xs font-mono font-bold text-[#0EA5E9]">
                  {combo.totalProtein}g P
                </span>
              </div>
              <div className="mt-1 text-[10px] text-[#0EA5E9] font-semibold flex items-center gap-1">
                <span>🎯 {combo.proteinMatchPct}% Protein Match</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Combo Deep Dive */}
      <div className="apple-subcard bg-slate-50 dark:bg-black/30 border border-slate-900/[0.06] dark:border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
            💡 {currentCombo.explanation}
          </p>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-900/[0.05]">
              C: {currentCombo.totalCarbs}g
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-900/[0.05]">
              F: {currentCombo.totalFat}g
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border border-slate-900/[0.05]">
              Fib: {currentCombo.totalFiber}g
            </span>
          </div>
        </div>

        {/* Decomposed Food Items in Combo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
          {currentCombo.items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-white/[0.03] rounded-xl p-2.5 text-[11px] border border-slate-900/[0.05] dark:border-white/[0.04] flex items-center justify-between shadow-xs"
            >
              <div>
                <p className="font-semibold text-[#0F172A] dark:text-white truncate max-w-[130px]">{item.name}</p>
                <p className="text-slate-500 dark:text-zinc-500 text-[10px]">
                  {item.grams}g · {item.calories} kcal
                </p>
              </div>
              <div className="text-right font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                <span className="text-[#0EA5E9] font-bold">{item.protein}g</span> P
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
