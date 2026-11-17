import { z } from 'zod';
import { env } from '../config/env.js';
import { FoodItemEntry } from '../types/index.js';
import { normalizeFoodItem } from '../utils/atwater.js';

// =========================================================================
// 1. USDA FoodData Central (FDC) Type-Safe Connector
// =========================================================================

export const UsdaNutrientSchema = z.object({
  nutrientId: z.number().optional(),
  nutrientName: z.string().optional(),
  value: z.number().default(0),
  unitName: z.string().optional(),
});

export const UsdaFoodItemSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string().optional(),
  foodNutrients: z.array(UsdaNutrientSchema).default([]),
});

export const UsdaSearchResponseSchema = z.object({
  totalHits: z.number().default(0),
  foods: z.array(UsdaFoodItemSchema).default([]),
});

export async function searchUsdaFoods(
  query: string,
  apiKey: string = env.USDA_FDC_API_KEY
): Promise<FoodItemEntry[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
    apiKey
  )}&query=${encodeURIComponent(cleanQuery)}&pageSize=5`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USDA API HTTP ${res.status}: ${res.statusText}`);
  }

  const rawJson = await res.json();
  const parsed = UsdaSearchResponseSchema.parse(rawJson);

  return parsed.foods.map((food) => {
    const nutrients = food.foodNutrients;
    const findNutrient = (namePatterns: string[]) => {
      const match = nutrients.find((n) =>
        namePatterns.some((p) => n.nutrientName?.toLowerCase().includes(p.toLowerCase()))
      );
      return match ? match.value : 0;
    };

    const calories = findNutrient(['Energy', 'Calories']);
    const protein = findNutrient(['Protein']);
    const carbs = findNutrient(['Carbohydrate, by difference']);
    const fat = findNutrient(['Total lipid (fat)']);
    const fiber = findNutrient(['Fiber, total dietary']);
    const sugar = findNutrient(['Sugars, total including NLEA']);
    const sodium = findNutrient(['Sodium, Na']);

    return normalizeFoodItem({
      id: `fdc-${food.fdcId}`,
      name: food.description,
      grams: 100,
      tier: 1,
      tierSource: `USDA FoodData Central #${food.fdcId}`,
      confidence: 0.99,
      reportedCalories: Math.round(calories),
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium: Math.round(sodium),
      fdcId: String(food.fdcId),
      cookingFatCategory: 'observable_low',
    });
  });
}

// =========================================================================
// 2. Open Food Facts Barcode Type-Safe Connector
// =========================================================================

export const OpenFoodFactsNutrimentsSchema = z.object({
  'energy-kcal_100g': z.number().optional(),
  proteins_100g: z.number().optional(),
  carbohydrates_100g: z.number().optional(),
  fat_100g: z.number().optional(),
  fiber_100g: z.number().optional(),
  sugars_100g: z.number().optional(),
  sodium_100g: z.number().optional(),
});

export const OpenFoodFactsProductSchema = z.object({
  code: z.string(),
  product: z
    .object({
      product_name: z.string().optional().default('Packaged Product'),
      brands: z.string().optional(),
      nutriments: OpenFoodFactsNutrimentsSchema.optional().default({}),
    })
    .optional(),
  status: z.number().optional(),
});

export async function lookupOpenFoodFactsBarcode(
  barcode: string,
  userAgent: string = env.OPEN_FOOD_FACTS_USER_AGENT
): Promise<FoodItemEntry | null> {
  const cleanCode = barcode.trim();
  if (!cleanCode) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent },
  });

  if (!res.ok) return null;

  const raw = await res.json();
  const parsed = OpenFoodFactsProductSchema.parse(raw);

  if (!parsed.product) return null;

  const nutriments = parsed.product.nutriments || {};
  const name = [parsed.product.brands, parsed.product.product_name]
    .filter(Boolean)
    .join(' ') || `Barcode Product #${cleanCode}`;

  return normalizeFoodItem({
    id: `barcode-${cleanCode}`,
    name,
    grams: 100,
    tier: 2,
    tierSource: `Open Food Facts Barcode #${cleanCode}`,
    confidence: 0.95,
    reportedCalories: Math.round(nutriments['energy-kcal_100g'] || 0),
    protein: nutriments.proteins_100g || 0,
    carbs: nutriments.carbohydrates_100g || 0,
    fat: nutriments.fat_100g || 0,
    fiber: nutriments.fiber_100g || 0,
    sugar: nutriments.sugars_100g || 0,
    sodium: Math.round((nutriments.sodium_100g || 0) * 1000), // convert g to mg
    barcode: cleanCode,
    cookingFatCategory: 'observable_low',
  });
}

// =========================================================================
// 3. HealthKit / CGM Active Burn & Glucose Type-Safe Sync Schema
// =========================================================================

export const HealthMetricsSyncSchema = z.object({
  uid: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeCaloriesBurned: z.number().nonnegative().optional(),
  stepCount: z.number().int().nonnegative().optional(),
  restingHeartRateBpm: z.number().positive().max(250).optional(),
  meanGlucoseMgDl: z.number().positive().max(500).optional(),
  source: z.enum(['apple_health', 'google_health_connect', 'ultrahuman_cgm', 'manual']),
});

export type HealthMetricsSync = z.infer<typeof HealthMetricsSyncSchema>;

export async function syncHealthMetrics(data: unknown): Promise<HealthMetricsSync> {
  const validated = HealthMetricsSyncSchema.parse(data);
  // Persist to user's daily biometric telemetry subcollection if Firestore is active
  const db = (await import('../lib/dataStore.js')).getFirestoreDb();
  if (db) {
    await db
      .collection('users')
      .doc(validated.uid)
      .collection('healthMetrics')
      .doc(validated.date)
      .set(validated, { merge: true });
  }
  return validated;
}
