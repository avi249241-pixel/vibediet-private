import { z } from 'zod';

export const WaterLogStrictSchema = z
  .object({
    amountMl: z.number().int().min(1).max(5000),
  })
  .strict();

export const WeightLogStrictSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weightKg: z.number().min(30).max(300),
    notes: z.string().max(300).optional(),
  })
  .strict();

export const BiometricsStrictSchema = z
  .object({
    age: z.number().int().min(12).max(120),
    gender: z.enum(['male', 'female', 'other']),
    weightKg: z.number().min(30).max(300),
    heightCm: z.number().min(100).max(250),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    goal: z.enum(['lose_fat', 'maintain', 'gain_muscle']),
    targetCalories: z.number().int().min(1200).max(6000).optional(),
    targetProtein: z.number().min(50).max(400).optional(),
    targetCarbs: z.number().min(50).max(800).optional(),
    targetFat: z.number().min(20).max(250).optional(),
  })
  .strict();
