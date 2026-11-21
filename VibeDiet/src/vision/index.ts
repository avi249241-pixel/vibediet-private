import { normalizeFoodItem } from '../shared/physics/atwater.js';
import { FoodItemEntry } from '../types/index.js';
import { CloudStructuredVisionEngine } from './cloudStructuredEngine.js';
import {
  findMatchingCatalogItem,
  getDefaultNutrientDensity,
  mapOilLevelToFatCategory,
  resolveDetectedItems,
  resolveFoodItem,
} from './nutritionResolver.js';
import { OnDeviceWasmVisionEngine } from './onDeviceWasmEngine.js';
import {
  CookingMethod,
  DetectedFoodItem,
  NutrientDensity,
  OIL_FAT_GRAMS_MAP,
  OilLevel,
  ResolvedFoodItem,
  VisionEngine,
  VisionEngineInput,
  VisionEngineProvider,
  VisionEngineResult,
} from './types.js';

/**
 * Active VisionEngine factory supporting pluggable cloud structured and on-device WASM inference.
 */
export function createVisionEngine(provider: VisionEngineProvider = 'cloud-structured'): VisionEngine {
  switch (provider) {
    case 'on-device-wasm':
      return new OnDeviceWasmVisionEngine();
    case 'cloud-structured':
    default:
      return new CloudStructuredVisionEngine();
  }
}

/**
 * Client-side 0ms instant nutrition recalculator.
 * Dynamically recomputes calories and macronutrients strictly through Atwater physics
 * when a user adjusts portion grams or selects an oil/ghee tier in the UI.
 */
export function recalculateItemNutrition(
  item: FoodItemEntry | ResolvedFoodItem,
  newGrams: number,
  newOilLevel: OilLevel,
  baseDensity?: NutrientDensity
): ResolvedFoodItem {
  const grams = Math.max(1, Math.round(newGrams));
  const cookingMethod: CookingMethod =
    (item as ResolvedFoodItem).cookingMethod || 'sauteed';
  const baseFoodName = (item as ResolvedFoodItem).baseFoodName || item.name;

  let density: NutrientDensity;

  if (baseDensity) {
    density = baseDensity;
  } else if (
    (item as ResolvedFoodItem).baseProteinPerGram != null &&
    (item as ResolvedFoodItem).baseCarbsPerGram != null &&
    (item as ResolvedFoodItem).baseFatPerGram != null &&
    (item as ResolvedFoodItem).baseFiberPerGram != null
  ) {
    const resolved = item as ResolvedFoodItem;
    density = {
      proteinPerGram: resolved.baseProteinPerGram!,
      carbsPerGram: resolved.baseCarbsPerGram!,
      baseFatPerGram: resolved.baseFatPerGram!,
      fiberPerGram: resolved.baseFiberPerGram!,
      sugarPerGram: resolved.baseSugarPerGram,
      sodiumPerGram: resolved.baseSodiumPerGram,
    };
  } else {
    // Derive density from matching catalog item or fallback
    const matched = findMatchingCatalogItem(baseFoodName);
    if (matched && matched.grams > 0) {
      density = {
        proteinPerGram: matched.protein / matched.grams,
        carbsPerGram: matched.carbs / matched.grams,
        baseFatPerGram: matched.fat / matched.grams,
        fiberPerGram: matched.fiber / matched.grams,
        sugarPerGram: (matched.sugar || 0) / matched.grams,
        sodiumPerGram: (matched.sodium || 0) / matched.grams,
      };
    } else {
      density = getDefaultNutrientDensity(baseFoodName, cookingMethod);
    }
  }

  // Scale base macros to portion mass
  const protein = Number((density.proteinPerGram * grams).toFixed(1));
  const carbs = Number((density.carbsPerGram * grams).toFixed(1));
  const baseFat = Number((density.baseFatPerGram * grams).toFixed(1));
  const fiber = Number((density.fiberPerGram * grams).toFixed(1));
  const sugar = Number(((density.sugarPerGram ?? 0) * grams).toFixed(1));
  const sodium = Math.round((density.sodiumPerGram ?? 0) * grams);

  // Deterministic oil / ghee fat addition
  const oilFatGramsAdded = OIL_FAT_GRAMS_MAP[newOilLevel] ?? 0.0;
  const totalFat = Number((baseFat + oilFatGramsAdded).toFixed(1));

  // Strict Atwater math: 4P + 4C + 9F === kcal
  const netCarbs = Math.max(0, Number((carbs - fiber).toFixed(1)));
  const calculatedCalories = Math.round(4 * protein + 4 * netCarbs + 9 * totalFat);

  const cookingFatCategory = mapOilLevelToFatCategory(newOilLevel);

  const normalized = normalizeFoodItem({
    ...item,
    grams,
    reportedCalories: calculatedCalories,
    calculatedCalories,
    calories: calculatedCalories,
    protein,
    carbs,
    fat: totalFat,
    fiber,
    sugar,
    sodium,
    cookingFatCategory,
  });

  return {
    ...normalized,
    cookingMethod,
    oilLevel: newOilLevel,
    baseFoodName,
    oilFatGramsAdded,
    baseGrams: grams,
    baseProteinPerGram: density.proteinPerGram,
    baseCarbsPerGram: density.carbsPerGram,
    baseFatPerGram: density.baseFatPerGram,
    baseFiberPerGram: density.fiberPerGram,
    baseSugarPerGram: density.sugarPerGram,
    baseSodiumPerGram: density.sodiumPerGram,
  };
}

export {
  CloudStructuredVisionEngine,
  OnDeviceWasmVisionEngine,
  resolveFoodItem,
  resolveDetectedItems,
  findMatchingCatalogItem,
  getDefaultNutrientDensity,
  mapOilLevelToFatCategory,
};

export type {
  CookingMethod,
  OilLevel,
  VisionEngineProvider,
  DetectedFoodItem,
  VisionEngineInput,
  VisionEngineResult,
  VisionEngine,
  NutrientDensity,
  ResolvedFoodItem,
};

export { OIL_FAT_GRAMS_MAP };
