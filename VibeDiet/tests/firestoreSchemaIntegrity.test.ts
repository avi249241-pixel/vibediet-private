import { describe, it, expect } from 'vitest';
import {
  FirestoreMealSchema,
  FirestoreDaySummarySchema,
  FirestorePhotoDraftSchema,
  FirestoreWeightLogSchema,
  FirestoreSupportTicketSchema,
  FirestoreBiometricsSchema,
} from '../src/schemas/v1.js';
import { dataStore } from '../src/lib/dataStore.js';

describe('Firestore Mutation Strict Schema Validation & Data Integrity', () => {
  const validMeal = {
    id: 'meal-test-1',
    date: '2026-10-25',
    slot: 'lunch' as const,
    title: 'Grilled Salmon Bowl',
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        name: 'Atlantic Salmon',
        grams: 150,
        tier: 1 as const,
        tierSource: 'USDA FDC',
        confidence: 0.99,
        reportedCalories: 250,
        calculatedCalories: 250,
        calories: 250,
        minCalories: 235,
        maxCalories: 265,
        protein: 34,
        carbs: 0,
        fat: 12,
        fiber: 0,
        sugar: 0,
        sodium: 95,
        hasAtwaterDiscrepancy: false,
        cookingFatCategory: 'observable_low' as const,
      },
    ],
    totalCalories: 250,
    minCalories: 235,
    maxCalories: 265,
    totalProtein: 34,
    totalCarbs: 0,
    totalFat: 12,
    totalFiber: 0,
    totalSugar: 0,
    totalSodium: 95,
    hasUnobservableFats: false,
    hasAtwaterDiscrepancy: false,
  };

  it('validates a well-formed meal document', () => {
    const parsed = FirestoreMealSchema.safeParse(validMeal);
    expect(parsed.success).toBe(true);
  });

  it('rejects corrupt meal documents with empty items or negative macros', () => {
    const corruptMeal = {
      ...validMeal,
      totalCalories: -50, // Negative calories illegal
      items: [], // At least 1 item required
    };
    const parsed = FirestoreMealSchema.safeParse(corruptMeal);
    expect(parsed.success).toBe(false);
  });

  it('enforces weight range boundaries between 25kg and 350kg', () => {
    const underWeight = {
      id: 'w-1',
      date: '2026-10-25',
      weightKg: 10, // Under 25kg min
      smoothedWeightKg: 10,
      createdAt: new Date().toISOString(),
    };
    expect(FirestoreWeightLogSchema.safeParse(underWeight).success).toBe(false);

    const validWeight = {
      id: 'w-2',
      date: '2026-10-25',
      weightKg: 75.5,
      smoothedWeightKg: 75.4,
      createdAt: new Date().toISOString(),
    };
    expect(FirestoreWeightLogSchema.safeParse(validWeight).success).toBe(true);
  });

  it('rejects corrupt draft mutations via dataStore before persistence', async () => {
    const corruptDraft: any = {
      id: 'draft-invalid',
      uid: 'user-1',
      date: 'not-a-date',
      slot: 'invalid-slot',
      status: 'unknown-status',
    };

    await expect(dataStore.saveDraft('user-1', corruptDraft)).rejects.toThrow();
  });

  it('validates user biometrics schema and enforces boundary constraints', () => {
    const validBio = {
      age: 28,
      gender: 'male' as const,
      heightCm: 178,
      weightKg: 78,
      activityLevel: 'moderately_active' as const,
      goalMode: 'moderate_cut' as const,
      bmr: 1780,
      baselineTdee: 2759,
      adaptiveTdee: 2759,
      targetCalories: 2345,
      targetProtein: 164,
      targetCarbs: 235,
      targetFat: 73,
      onboarded: true,
    };
    expect(FirestoreBiometricsSchema.safeParse(validBio).success).toBe(true);

    const invalidBio = {
      ...validBio,
      age: 5, // Under 10 years min
    };
    expect(FirestoreBiometricsSchema.safeParse(invalidBio).success).toBe(false);
  });
});
