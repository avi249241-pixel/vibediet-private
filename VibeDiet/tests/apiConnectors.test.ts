import { describe, it, expect } from 'vitest';
import {
  UsdaSearchResponseSchema,
  OpenFoodFactsProductSchema,
  HealthMetricsSyncSchema,
} from '../src/services/apiConnectors.js';
import { DESIGN_TOKENS } from '../src/tokens/designTokens.js';

describe('External API Connectors & Design Tokens Validation', () => {
  it('enforces design token structure matching Figma & Canva specifications', () => {
    expect(DESIGN_TOKENS.colors.primary).toBe('#10b981');
    expect(DESIGN_TOKENS.colors.tier1Verified.hex).toBe('#10b981');
    expect(DESIGN_TOKENS.colors.tier2Barcode.hex).toBe('#38bdf8');
    expect(DESIGN_TOKENS.colors.tier3AiVision.hex).toBe('#a855f7');
    expect(DESIGN_TOKENS.colors.tier4UserEstimate.hex).toBe('#64748b');
    expect(DESIGN_TOKENS.typography.fontBody).toContain('Plus Jakarta Sans');
  });

  it('validates raw USDA API JSON response through UsdaSearchResponseSchema', () => {
    const mockUsdaPayload = {
      totalHits: 1,
      foods: [
        {
          fdcId: 171705,
          description: 'Avocados, raw, all commercial varieties',
          foodNutrients: [
            { nutrientName: 'Energy', value: 160 },
            { nutrientName: 'Protein', value: 2.0 },
            { nutrientName: 'Total lipid (fat)', value: 14.66 },
            { nutrientName: 'Carbohydrate, by difference', value: 8.53 },
          ],
        },
      ],
    };

    const parsed = UsdaSearchResponseSchema.safeParse(mockUsdaPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.foods[0].fdcId).toBe(171705);
    }
  });

  it('validates Open Food Facts Barcode payload schema', () => {
    const mockBarcodePayload = {
      code: '8901058000290',
      status: 1,
      product: {
        product_name: 'Maggi 2-Minute Noodles',
        brands: 'Nestle',
        nutriments: {
          'energy-kcal_100g': 427,
          proteins_100g: 8.0,
          carbohydrates_100g: 63.5,
          fat_100g: 15.7,
          fiber_100g: 3.5,
          sodium_100g: 1.18,
        },
      },
    };

    const parsed = OpenFoodFactsProductSchema.safeParse(mockBarcodePayload);
    expect(parsed.success).toBe(true);
  });

  it('validates HealthKit / CGM biometric sync schema', () => {
    const validHealthData = {
      uid: 'user-athlete-1',
      date: '2026-10-25',
      activeCaloriesBurned: 640,
      stepCount: 11250,
      restingHeartRateBpm: 58,
      meanGlucoseMgDl: 94,
      source: 'apple_health' as const,
    };

    const parsed = HealthMetricsSyncSchema.safeParse(validHealthData);
    expect(parsed.success).toBe(true);
  });
});
