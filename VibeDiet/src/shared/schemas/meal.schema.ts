import { z } from 'zod';

export const EvidenceTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const MealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

export const CookingFatCategorySchema = z.enum([
  'observable_low',
  'observable_moderate',
  'unobservable_unknown',
]);

export const FoodItemEntrySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    grams: z.number().min(0),
    tier: EvidenceTierSchema,
    reportedCalories: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
    fiber: z.number().min(0).default(0),
    sugar: z.number().min(0).default(0),
    sodium: z.number().min(0).default(0),
    cookingFatCategory: CookingFatCategorySchema.optional(),
    cookingMethod: z.string().optional(),
    tierSource: z.string().optional(),
    visualConfidence: z.number().min(0).max(1).optional(),
    referenceAnchor: z.string().optional(),
    volumeCm3: z.number().min(0).optional(),
    densityGPerCm3: z.number().min(0).optional(),
    detectedPackagingOrLabel: z.string().optional(),
  })
  .strict();

export const CreateDraftMediaSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    slot: MealSlotSchema,
    imageBase64: z.string().min(1),
    thumbnailDataUrl: z.string().optional(),
  })
  .strict();

export const CreateTextDraftMediaSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    slotHint: MealSlotSchema.optional(),
    mealDescription: z.string().min(2),
  })
  .strict();

export const ClarifyDraftInputSchema = z
  .object({
    answers: z.record(z.string(), z.string()),
  })
  .strict();

export const ConfirmDraftInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    slot: MealSlotSchema.optional(),
    title: z.string().optional(),
    items: z.array(FoodItemEntrySchema).optional(),
  })
  .strict();
