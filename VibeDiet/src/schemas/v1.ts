import { z } from 'zod';

export const MealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const EvidenceTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const CookingFatCategorySchema = z.enum([
  'observable_low',
  'observable_moderate',
  'unobservable_unknown',
]);

export const FoodItemInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  grams: z.number().positive().max(5000).default(100),
  tier: EvidenceTierSchema.default(4),
  tierSource: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reportedCalories: z.number().nonnegative().default(0),
  calories: z.number().nonnegative().optional(),
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fat: z.number().nonnegative().default(0),
  fiber: z.number().nonnegative().default(0),
  sugar: z.number().nonnegative().default(0),
  sodium: z.number().nonnegative().default(0),
  alcohol: z.number().nonnegative().optional(),
  cookingFatCategory: CookingFatCategorySchema.default('observable_low'),
  fdcId: z.string().optional(),
  barcode: z.string().optional(),
  referenceAnchor: z.string().optional(),
  servingMultiplier: z.number().positive().optional(),
  scanMode: z.enum(['plate_vision', 'nutrition_label_ocr']).optional(),
});

export const CreateDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slot: MealSlotSchema.default('lunch'),
  imageBase64: z.string().min(10),
  thumbnailDataUrl: z.string().optional(),
  mealHint: z.string().max(500).optional(),
  contextNote: z.string().max(500).optional(),
  scanMode: z.enum(['plate_vision', 'nutrition_label_ocr']).optional(),
  servingMultiplier: z.number().positive().optional(),
});

export const CreateTextDraftSchema = z.object({
  mealDescription: z.string().min(3).max(600),
  slotHint: MealSlotSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ClarifyDraftSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export const ConfirmDraftSchema = z.object({
  slot: MealSlotSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().min(1).max(200).optional(),
  items: z.array(FoodItemInputSchema).optional(),
});

export const CreateManualMealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: MealSlotSchema,
  title: z.string().min(1).max(200),
  items: z.array(FoodItemInputSchema).min(1),
});

export const PatchMealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slot: MealSlotSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  items: z.array(FoodItemInputSchema).min(1).optional(),
  waterMlDelta: z.number().optional(),
});

export const CopyMealSchema = z.object({
  sourceMealId: z.string().min(1),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetSlot: MealSlotSchema.optional(),
});

export const RepeatMealCreateSchema = z.object({
  title: z.string().min(1).max(200),
  slot: MealSlotSchema.default('lunch'),
  items: z.array(FoodItemInputSchema).min(1),
});

export const WeightLogCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().min(25).max(350),
});

export const SupportTicketCreateSchema = z.object({
  category: z.enum(['bug', 'nutrition_fix', 'account', 'feedback']),
  subject: z.string().min(3).max(200),
  message: z.string().min(5).max(3000),
});

export const WaterLogSchema = z.object({
  deltaMl: z.number().int().min(-2000).max(5000),
});

export const UpdateBiometricsSchema = z.object({
  age: z.number().int().min(10).max(120).optional(),
  gender: z.enum(['male', 'female']).optional(),
  heightCm: z.number().min(50).max(280).optional(),
  weightKg: z.number().min(25).max(350).optional(),
  activityLevel: z.enum([
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active',
  ]).optional(),
  goalMode: z.enum([
    'aggressive_cut',
    'moderate_cut',
    'maintenance',
    'lean_bulk',
  ]).optional(),
  onboarded: z.boolean().optional(),
});

// =========================================================================
// STRICT FIRESTORE MUTATION & DOCUMENT SCHEMAS (Data Integrity Enforcement)
// =========================================================================

export const FirestoreFoodItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  grams: z.number().positive().max(5000),
  tier: EvidenceTierSchema,
  tierSource: z.string(),
  confidence: z.number().min(0).max(1),
  reportedCalories: z.number().nonnegative(),
  calculatedCalories: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  minCalories: z.number().nonnegative(),
  maxCalories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
  alcohol: z.number().nonnegative().optional(),
  hasAtwaterDiscrepancy: z.boolean(),
  cookingFatCategory: CookingFatCategorySchema,
  fdcId: z.string().optional(),
  barcode: z.string().optional(),
  volumeCm3: z.number().optional(),
  densityGPerCm3: z.number().optional(),
});

export const FirestoreMealSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: MealSlotSchema,
  title: z.string().min(1).max(200),
  createdAt: z.string().datetime({ offset: true }).or(z.string()),
  thumbnailDataUrl: z.string().optional(),
  items: z.array(FirestoreFoodItemSchema).min(1),
  totalCalories: z.number().nonnegative(),
  minCalories: z.number().nonnegative(),
  maxCalories: z.number().nonnegative(),
  totalProtein: z.number().nonnegative(),
  totalCarbs: z.number().nonnegative(),
  totalFat: z.number().nonnegative(),
  totalFiber: z.number().nonnegative(),
  totalSugar: z.number().nonnegative(),
  totalSodium: z.number().nonnegative(),
  hasUnobservableFats: z.boolean(),
  hasAtwaterDiscrepancy: z.boolean(),
  isDemoMode: z.boolean().optional(),
});

export const FirestoreDaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalCalories: z.number().nonnegative(),
  totalProtein: z.number().nonnegative(),
  totalCarbs: z.number().nonnegative(),
  totalFat: z.number().nonnegative(),
  totalFiber: z.number().nonnegative(),
  totalSugar: z.number().nonnegative(),
  totalSodium: z.number().nonnegative(),
  waterMl: z.number().nonnegative(),
  meals: z.array(FirestoreMealSchema),
  updatedAt: z.string().datetime({ offset: true }).or(z.string()),
});

export const ClarifyingQuestionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  calorieDelta: z.number(),
  fatDeltaGrams: z.number(),
  carbDeltaGrams: z.number(),
  proteinDeltaGrams: z.number(),
});

export const ClarifyingQuestionSchema = z.object({
  id: z.string().min(1),
  targetItemId: z.string().optional(),
  question: z.string().min(1),
  options: z.array(ClarifyingQuestionOptionSchema),
  selectedOptionId: z.string().optional(),
});

export const FirestorePhotoDraftSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: MealSlotSchema,
  status: z.enum(['queued', 'processing', 'ready_for_review', 'confirmed', 'failed', 'expired']),
  createdAt: z.string().datetime({ offset: true }).or(z.string()),
  updatedAt: z.string().datetime({ offset: true }).or(z.string()),
  imageBase64: z.string().optional(),
  thumbnailDataUrl: z.string().optional(),
  mealTitle: z.string().optional(),
  referenceAnchor: z.string().optional(),
  recognizedItems: z.array(FirestoreFoodItemSchema),
  questions: z.array(ClarifyingQuestionSchema),
  isDemoMode: z.boolean(),
  stage: z.enum(['spatial_ocr', 'parallel_fats_grounding', 'atwater_verified']).optional(),
  contextNote: z.string().optional(),
  mealHint: z.string().optional(),
  scanMode: z.enum(['plate_vision', 'nutrition_label_ocr']).optional(),
  servingMultiplier: z.number().optional(),
  errorMessage: z.string().optional(),
  confirmedMealId: z.string().optional(),
}).passthrough();

export const FirestoreWeightLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().min(25).max(350),
  smoothedWeightKg: z.number().min(25).max(350),
  createdAt: z.string().datetime({ offset: true }).or(z.string()),
});

export const FirestoreSupportTicketSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  category: z.enum(['bug', 'nutrition_fix', 'account', 'feedback']),
  subject: z.string().min(3).max(200),
  message: z.string().min(5).max(3000),
  status: z.enum(['open', 'in_progress', 'resolved']),
  createdAt: z.string().datetime({ offset: true }).or(z.string()),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
});

export const FirestoreBiometricsSchema = z.object({
  age: z.number().int().min(10).max(120),
  gender: z.enum(['male', 'female']),
  heightCm: z.number().min(50).max(280),
  weightKg: z.number().min(25).max(350),
  activityLevel: z.enum([
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active',
  ]),
  goalMode: z.enum([
    'aggressive_cut',
    'moderate_cut',
    'maintenance',
    'lean_bulk',
  ]),
  bmr: z.number().nonnegative(),
  baselineTdee: z.number().nonnegative(),
  adaptiveTdee: z.number().nonnegative(),
  targetCalories: z.number().nonnegative(),
  targetProtein: z.number().nonnegative(),
  targetCarbs: z.number().nonnegative(),
  targetFat: z.number().nonnegative(),
  onboarded: z.boolean(),
  updatedAt: z.string().datetime({ offset: true }).or(z.string()).optional(),
});
