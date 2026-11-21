import { FoodItemEntry } from '../types/index.js';

export type CookingMethod =
  | 'steamed'
  | 'boiled'
  | 'tawa_roasted'
  | 'sauteed'
  | 'deep_fried'
  | 'creamy_gravy';

export type OilLevel = 'none' | 'light' | 'standard' | 'heavy';

export const OIL_FAT_GRAMS_MAP: Record<OilLevel, number> = {
  none: 0.0,
  light: 2.5,
  standard: 5.0,
  heavy: 10.0,
} as const;

export type VisionEngineProvider = 'cloud-structured' | 'on-device-wasm';

export interface DetectedFoodItem {
  id: string;
  name: string;
  estimatedGrams: number;
  cookingMethod: CookingMethod;
  oilLevel: OilLevel;
  confidence: number; // 0..1
  referenceAnchor?: string;
  visualNotes?: string;
}

export interface VisionEngineInput {
  imageBase64: string;
  mimeType?: string;
  mealHint?: string;
  contextNote?: string;
}

export interface VisionEngineResult {
  mealTitle: string;
  referenceAnchor: string;
  items: DetectedFoodItem[];
  engineProvider: VisionEngineProvider;
  latencyMs: number;
  rawResponse?: string;
}

export interface VisionEngine {
  readonly provider: VisionEngineProvider;
  analyzeMealImage(input: VisionEngineInput): Promise<VisionEngineResult>;
}

export interface NutrientDensity {
  proteinPerGram: number;
  carbsPerGram: number;
  baseFatPerGram: number;
  fiberPerGram: number;
  sugarPerGram?: number;
  sodiumPerGram?: number;
}

export interface ResolvedFoodItem extends FoodItemEntry {
  cookingMethod: CookingMethod;
  oilLevel: OilLevel;
  baseFoodName: string;
  oilFatGramsAdded: number;
  baseGrams?: number;
  baseProteinPerGram?: number;
  baseCarbsPerGram?: number;
  baseFatPerGram?: number;
  baseFiberPerGram?: number;
  baseSugarPerGram?: number;
  baseSodiumPerGram?: number;
}
