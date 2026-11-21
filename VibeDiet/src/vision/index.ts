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

export function createVisionEngine(provider: VisionEngineProvider = 'cloud-structured'): VisionEngine {
  switch (provider) {
    case 'on-device-wasm':
      return new OnDeviceWasmVisionEngine();
    case 'cloud-structured':
    default:
      return new CloudStructuredVisionEngine();
  }
}

export function recalculateItemNutrition(
  item: FoodItemEntry | ResolvedFoodItem,
  newGrams: number,
  newOilLevel: OilLevel,
  baseDensity?: NutrientDensity
): ResolvedFoodItem {
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

  return computeResolvedMacros({
    baseEntry: item,
    grams: newGrams,
    density,
    cookingMethod,
    oilLevel: newOilLevel,
    baseFoodName,
  });
}

export {
  CloudStructuredVisionEngine,
  OnDeviceWasmVisionEngine,
  computeResolvedMacros,
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