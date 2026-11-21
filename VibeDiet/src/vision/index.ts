import { normalizeFoodItem } from '../shared/physics/atwater.js';
import { FoodItemEntry } from '../types/index.js';
import { CloudStructuredVisionEngine } from './cloudStructuredEngine.js';
import {
  computeResolvedMacros,
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

  // Use single shared macro and Atwater calculation engine
  const macros = computeResolvedMacros(density, grams, newOilLevel);
  const cookingFatCategory = mapOilLevelToFatCategory(newOilLevel);

  const normalized = normalizeFoodItem({
    ...item,
    grams: macros.grams,
    reportedCalories: macros.calculatedCalories,
    calculatedCalories: macros.calculatedCalories,
    calories: macros.calculatedCalories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.totalFat,
    fiber: macros.fiber,
    sugar: macros.sugar,
    sodium: macros.sodium,
    cookingFatCategory,
  });

  return {
    ...normalized,
    cookingMethod,
    oilLevel: newOilLevel,
    baseFoodName,
    oilFatGramsAdded: macros.oilFatGramsAdded,
    baseGrams: macros.grams,
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
  computeResolvedMacros,
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
