import { LOCAL_VERIFIED_CATALOG, foodCatalogService } from '../services/foodCatalogService.js';
import { normalizeFoodItem } from '../shared/physics/atwater.js';
import { CookingFatCategory, EvidenceTier, FoodItemEntry } from '../types/index.js';
import {
  CookingMethod,
  DetectedFoodItem,
  NutrientDensity,
  OIL_FAT_GRAMS_MAP,
  OilLevel,
  ResolvedFoodItem,
} from './types.js';

/**
 * Normalizes strings for robust matching against food catalog items.
 */
function cleanQuery(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Common culinary synonyms and keyword aliases for staple Indian and global dishes.
 */
const FOOD_ALIAS_MAP: Record<string, string> = {
  roti: 'phulka',
  chapati: 'phulka',
  phulka: 'phulka',
  paratha: 'paratha',
  naan: 'naan',
  dal: 'dal',
  daal: 'dal',
  tadka: 'tadka',
  makhani: 'dal-makhani',
  rice: 'rice',
  chawal: 'rice',
  basmati: 'rice',
  paneer: 'paneer',
  bhurji: 'paneer',
  chicken: 'chicken',
  dosa: 'dosa',
  idli: 'idli',
  sambar: 'sambar',
  chutney: 'chutney',
  curry: 'curry',
  sabzi: 'sabzi',
  subzi: 'sabzi',
  yogurt: 'yogurt',
  curd: 'curd',
  chaas: 'chaas',
  buttermilk: 'chaas',
  egg: 'egg',
  omelette: 'omelette',
};

/**
 * Finds the most representative catalog entry for a detected food dish name.
 */
export function findMatchingCatalogItem(dishName: string): FoodItemEntry | null {
  const cleaned = cleanQuery(dishName);
  if (!cleaned) return null;

  // 1. Direct local search via foodCatalogService
  const localMatches = foodCatalogService.searchLocal(cleaned);
  if (localMatches.length > 0) {
    // Return the match whose name is most relevant
    const bestMatch = localMatches.find((m) => cleanQuery(m.name) === cleaned) || localMatches[0];
    return bestMatch;
  }

  // 2. Tokenized word matching across LOCAL_VERIFIED_CATALOG
  const tokens = cleaned.split(' ').filter((t) => t.length > 2);
  let bestScore = 0;
  let bestEntry: FoodItemEntry | null = null;

  for (const entry of LOCAL_VERIFIED_CATALOG) {
    const entryClean = cleanQuery(entry.name);
    let score = 0;

    for (const token of tokens) {
      if (entryClean.includes(token)) {
        score += 2;
      }
      const alias = FOOD_ALIAS_MAP[token];
      if (alias && entryClean.includes(alias)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= 2) {
    return bestEntry;
  }

  return null;
}

/**
 * Returns default nutrient density per gram based on cooking method and culinary profile
 * when a dish is not explicitly present in the verified catalog.
 */
export function getDefaultNutrientDensity(
  name: string,
  cookingMethod: CookingMethod
): NutrientDensity {
  const clean = cleanQuery(name);

  // Dal / Lentils
  if (/dal|lentil|sambar|chana|rajma|choor/i.test(clean)) {
    return {
      proteinPerGram: 0.058,
      carbsPerGram: 0.145,
      baseFatPerGram: 0.022,
      fiberPerGram: 0.032,
      sugarPerGram: 0.012,
      sodiumPerGram: 3.2,
    };
  }

  // Paneer / Dairy
  if (/paneer|cottage|cheese/i.test(clean)) {
    return {
      proteinPerGram: 0.145,
      carbsPerGram: 0.042,
      baseFatPerGram: 0.165,
      fiberPerGram: 0.005,
      sugarPerGram: 0.015,
      sodiumPerGram: 2.8,
    };
  }

  // Chicken / Poultry
  if (/chicken|poultry|tikka|murgh/i.test(clean)) {
    return {
      proteinPerGram: 0.22,
      carbsPerGram: 0.02,
      baseFatPerGram: 0.065,
      fiberPerGram: 0.002,
      sugarPerGram: 0.005,
      sodiumPerGram: 3.5,
    };
  }

  // Rice / Grains
  if (/rice|chawal|biryani|pulao|grain|quinoa/i.test(clean)) {
    return {
      proteinPerGram: 0.028,
      carbsPerGram: 0.282,
      baseFatPerGram: 0.004,
      fiberPerGram: 0.006,
      sugarPerGram: 0.001,
      sodiumPerGram: 0.2,
    };
  }

  // Roti / Flatbreads
  if (/roti|phulka|chapati|paratha|naan|bread/i.test(clean)) {
    return {
      proteinPerGram: 0.095,
      carbsPerGram: 0.52,
      baseFatPerGram: 0.018,
      fiberPerGram: 0.082,
      sugarPerGram: 0.01,
      sodiumPerGram: 0.1,
    };
  }

  // Vegetables / Sabzi
  if (/sabzi|subzi|vegetable|aloo|gobi|bhindi|spinach|palak/i.test(clean)) {
    return {
      proteinPerGram: 0.024,
      carbsPerGram: 0.085,
      baseFatPerGram: 0.025,
      fiberPerGram: 0.035,
      sugarPerGram: 0.025,
      sodiumPerGram: 2.5,
    };
  }

  // Yogurt / Beverage
  if (/curd|yogurt|dahi|chaas|lassi|buttermilk/i.test(clean)) {
    return {
      proteinPerGram: 0.035,
      carbsPerGram: 0.048,
      baseFatPerGram: 0.018,
      fiberPerGram: 0.0,
      sugarPerGram: 0.042,
      sodiumPerGram: 0.5,
    };
  }

  // Method-driven fallback
  switch (cookingMethod) {
    case 'steamed':
    case 'boiled':
      return {
        proteinPerGram: 0.04,
        carbsPerGram: 0.18,
        baseFatPerGram: 0.008,
        fiberPerGram: 0.018,
        sugarPerGram: 0.01,
        sodiumPerGram: 1.0,
      };
    case 'creamy_gravy':
      return {
        proteinPerGram: 0.06,
        carbsPerGram: 0.10,
        baseFatPerGram: 0.085,
        fiberPerGram: 0.02,
        sugarPerGram: 0.025,
        sodiumPerGram: 3.5,
      };
    case 'deep_fried':
      return {
        proteinPerGram: 0.06,
        carbsPerGram: 0.24,
        baseFatPerGram: 0.12,
        fiberPerGram: 0.02,
        sugarPerGram: 0.015,
        sodiumPerGram: 3.0,
      };
    case 'tawa_roasted':
    case 'sauteed':
    default:
      return {
        proteinPerGram: 0.05,
        carbsPerGram: 0.15,
        baseFatPerGram: 0.03,
        fiberPerGram: 0.025,
        sugarPerGram: 0.015,
        sodiumPerGram: 2.0,
      };
  }
}

/**
 * Maps an oil level to its standard cookingFatCategory for Atwater uncertainty modeling.
 */
export function mapOilLevelToFatCategory(oilLevel: OilLevel): CookingFatCategory {
  switch (oilLevel) {
    case 'none':
      return 'observable_low';
    case 'light':
      return 'observable_low';
    case 'standard':
      return 'observable_moderate';
    case 'heavy':
      return 'unobservable_unknown';
    default:
      return 'observable_low';
  }
}

/**
 * Resolves a single DetectedFoodItem into an authoritative, Atwater-reconciled ResolvedFoodItem.
 * Deterministically adds cooking oil / ghee fat grams and ensures 4P + 4C + 9F === kcal.
 */
export function resolveFoodItem(item: DetectedFoodItem): ResolvedFoodItem {
  const grams = Math.max(1, Math.round(item.estimatedGrams || 100));
  const matchedCatalog = findMatchingCatalogItem(item.name);

  let density: NutrientDensity;
  let tier: EvidenceTier = 3;
  let tierSource = 'Gemini Multimodal Vision + Nutrition Resolver';
  let baseFoodName = item.name;
  let fdcId: string | undefined = undefined;

  if (matchedCatalog && matchedCatalog.grams > 0) {
    tier = matchedCatalog.tier;
    tierSource = matchedCatalog.tierSource;
    baseFoodName = matchedCatalog.name;
    fdcId = matchedCatalog.fdcId;

    const baseG = matchedCatalog.grams;
    density = {
      proteinPerGram: matchedCatalog.protein / baseG,
      carbsPerGram: matchedCatalog.carbs / baseG,
      baseFatPerGram: matchedCatalog.fat / baseG,
      fiberPerGram: matchedCatalog.fiber / baseG,
      sugarPerGram: (matchedCatalog.sugar || 0) / baseG,
      sodiumPerGram: (matchedCatalog.sodium || 0) / baseG,
    };
  } else {
    density = getDefaultNutrientDensity(item.name, item.cookingMethod);
  }

  // Scale base macros to portion mass
  const baseProtein = Number((density.proteinPerGram * grams).toFixed(1));
  const baseCarbs = Number((density.carbsPerGram * grams).toFixed(1));
  const baseFat = Number((density.baseFatPerGram * grams).toFixed(1));
  const fiber = Number((density.fiberPerGram * grams).toFixed(1));
  const sugar = Number(((density.sugarPerGram ?? 0) * grams).toFixed(1));
  const sodium = Math.round((density.sodiumPerGram ?? 0) * grams);

  // Deterministic oil / ghee fat addition
  const oilFatGramsAdded = OIL_FAT_GRAMS_MAP[item.oilLevel] ?? 0.0;
  const totalFat = Number((baseFat + oilFatGramsAdded).toFixed(1));

  // Strict Atwater reconciliation
  const netCarbs = Math.max(0, Number((baseCarbs - fiber).toFixed(1)));
  const calculatedCalories = Math.round(4 * baseProtein + 4 * netCarbs + 9 * totalFat);

  const cookingFatCategory = mapOilLevelToFatCategory(item.oilLevel);

  const normalized = normalizeFoodItem({
    id: item.id || `item-${Math.random().toString(36).slice(2, 9)}`,
    name: item.name,
    grams,
    tier,
    tierSource,
    confidence: item.confidence ?? 0.85,
    reportedCalories: calculatedCalories,
    calculatedCalories,
    calories: calculatedCalories,
    protein: baseProtein,
    carbs: baseCarbs,
    fat: totalFat,
    fiber,
    sugar,
    sodium,
    cookingFatCategory,
    referenceAnchor: item.referenceAnchor,
    fdcId,
  });

  return {
    ...normalized,
    cookingMethod: item.cookingMethod,
    oilLevel: item.oilLevel,
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

/**
 * Resolves an array of DetectedFoodItems into verified ResolvedFoodItems.
 */
export function resolveDetectedItems(items: DetectedFoodItem[]): ResolvedFoodItem[] {
  return items.map((item) => resolveFoodItem(item));
}
