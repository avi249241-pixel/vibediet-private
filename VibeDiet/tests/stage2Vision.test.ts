import { describe, it, expect, beforeEach } from 'vitest';
import {
  createVisionEngine,
  recalculateItemNutrition,
  resolveDetectedItems,
  resolveFoodItem,
  findMatchingCatalogItem,
  getDefaultNutrientDensity,
  CloudStructuredVisionEngine,
  OnDeviceWasmVisionEngine,
  OIL_FAT_GRAMS_MAP,
  type DetectedFoodItem,
  type OilLevel,
  type CookingMethod,
} from '../src/vision/index.js';
import { keyPoolRouter } from '../src/services/keyPoolRouter.js';
import { runVisionEngineSwarm } from '../src/services/geminiNutritionSwarm.js';

describe('Milestone 2: Swappable VisionEngine Architecture', () => {
  beforeEach(() => {
    keyPoolRouter.reloadKeys('');
  });

  describe('1. Active VisionEngine Factory & Pluggable Providers', () => {
    it('creates CloudStructuredVisionEngine by default and for cloud-structured', () => {
      const defaultEngine = createVisionEngine();
      expect(defaultEngine).toBeInstanceOf(CloudStructuredVisionEngine);
      expect(defaultEngine.provider).toBe('cloud-structured');

      const cloudEngine = createVisionEngine('cloud-structured');
      expect(cloudEngine).toBeInstanceOf(CloudStructuredVisionEngine);
      expect(cloudEngine.provider).toBe('cloud-structured');
    });

    it('creates OnDeviceWasmVisionEngine for on-device-wasm', () => {
      const wasmEngine = createVisionEngine('on-device-wasm');
      expect(wasmEngine).toBeInstanceOf(OnDeviceWasmVisionEngine);
      expect(wasmEngine.provider).toBe('on-device-wasm');
    });

    it('OnDeviceWasmVisionEngine gracefully handles non-browser environment', async () => {
      const wasmEngine = new OnDeviceWasmVisionEngine();
      expect(wasmEngine.isEnvironmentSupported()).toBe(false);

      const isCached = await wasmEngine.checkModelCached();
      expect(isCached).toBe(false);

      await expect(
        wasmEngine.analyzeMealImage({
          imageBase64: 'fake-base64-data',
        })
      ).rejects.toThrow(/WebAssembly and OPFS-capable browser environment/);
    });

    it('CloudStructuredVisionEngine throws honest error when API keys are unconfigured', async () => {
      const cloudEngine = new CloudStructuredVisionEngine();
      expect(keyPoolRouter.hasConfiguredKeys()).toBe(false);

      await expect(
        cloudEngine.analyzeMealImage({
          imageBase64: 'fake-base64-data',
        })
      ).rejects.toThrow(/GEMINI_API_KEY is not configured/);
    });
  });

  describe('2. Nutrition Resolver & Deterministic Oil/Ghee Fat Grounding', () => {
    it('accurately resolves whole wheat phulka against LOCAL_VERIFIED_CATALOG', () => {
      const matched = findMatchingCatalogItem('Whole Wheat Phulka Roti');
      expect(matched).toBeDefined();
      expect(matched?.name.toLowerCase()).toContain('phulka');

      const detected: DetectedFoodItem = {
        id: 'item-phulka',
        name: 'Whole Wheat Phulka',
        estimatedGrams: 70, // 2 standard phulkas (35g each)
        cookingMethod: 'tawa_roasted',
        oilLevel: 'none',
        confidence: 0.95,
      };

      const resolved = resolveFoodItem(detected);
      expect(resolved.grams).toBe(70);
      expect(resolved.protein).toBeCloseTo(6.8, 1);
      expect(resolved.oilFatGramsAdded).toBe(0.0);
      expect(resolved.fat).toBeCloseTo(1.0, 1);

      // Verify Atwater invariant: 4P + 4C + 9F === kcal
      const netCarbs = Math.max(0, resolved.carbs - resolved.fiber);
      const expectedCalories = Math.round(4 * resolved.protein + 4 * netCarbs + 9 * resolved.fat);
      expect(Math.abs(resolved.calories - expectedCalories)).toBeLessThanOrEqual(1);
    });

    it('applies deterministic oil/ghee fat adjustments across none, light, standard, and heavy', () => {
      const oilLevels: OilLevel[] = ['none', 'light', 'standard', 'heavy'];
      const expectedFatAdditions = [0.0, 2.5, 5.0, 10.0];

      oilLevels.forEach((level, idx) => {
        expect(OIL_FAT_GRAMS_MAP[level]).toBe(expectedFatAdditions[idx]);

        const item: DetectedFoodItem = {
          id: `item-dal-${level}`,
          name: 'Yellow Dal Tadka',
          estimatedGrams: 150,
          cookingMethod: 'boiled',
          oilLevel: level,
          confidence: 0.92,
        };

        const resolved = resolveFoodItem(item);
        expect(resolved.oilLevel).toBe(level);
        expect(resolved.oilFatGramsAdded).toBe(expectedFatAdditions[idx]);

        // Verify Atwater consistency
        const netCarbs = Math.max(0, resolved.carbs - resolved.fiber);
        const expectedCalories = Math.round(4 * resolved.protein + 4 * netCarbs + 9 * resolved.fat);
        expect(resolved.calories).toBe(expectedCalories);
      });
    });

    it('verifies strict Atwater invariant 4P + 4C + 9F === kcal for a 3-item thali', () => {
      const detectedItems: DetectedFoodItem[] = [
        {
          id: 'item-1',
          name: 'Steamed Basmati Rice',
          estimatedGrams: 150,
          cookingMethod: 'steamed',
          oilLevel: 'none',
          confidence: 0.98,
        },
        {
          id: 'item-2',
          name: 'Paneer Tikka Masala',
          estimatedGrams: 180,
          cookingMethod: 'creamy_gravy',
          oilLevel: 'heavy',
          confidence: 0.91,
        },
        {
          id: 'item-3',
          name: 'Tawa Roti with Ghee',
          estimatedGrams: 75,
          cookingMethod: 'tawa_roasted',
          oilLevel: 'light',
          confidence: 0.96,
        },
      ];

      const resolved = resolveDetectedItems(detectedItems);
      expect(resolved.length).toBe(3);

      resolved.forEach((item) => {
        const netCarbs = Math.max(0, item.carbs - item.fiber);
        const atwaterKcal = Math.round(4 * item.protein + 4 * netCarbs + 9 * item.fat);
        expect(Math.abs(item.calories - atwaterKcal)).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('3. Client-Side Instant Recalculation (recalculateItemNutrition)', () => {
    it('instantaneously recalculates macros when portion grams change from 100g to 200g', () => {
      const initial: DetectedFoodItem = {
        id: 'item-paneer',
        name: 'Paneer Bhurji',
        estimatedGrams: 100,
        cookingMethod: 'sauteed',
        oilLevel: 'standard',
        confidence: 0.94,
      };

      const baseResolved = resolveFoodItem(initial);

      // User adjusts slider to 200g in UI
      const t0 = performance.now();
      const doubled = recalculateItemNutrition(baseResolved, 200, 'standard');
      const latencyMs = performance.now() - t0;

      // 0ms client-side execution verification
      expect(latencyMs).toBeLessThan(10);

      expect(doubled.grams).toBe(200);
      expect(doubled.protein).toBeCloseTo(baseResolved.protein * 2, 0);

      // Atwater verification on recalculated item
      const netCarbs = Math.max(0, doubled.carbs - doubled.fiber);
      const expectedCalories = Math.round(4 * doubled.protein + 4 * netCarbs + 9 * doubled.fat);
      expect(Math.abs(doubled.calories - expectedCalories)).toBeLessThanOrEqual(1);
    });

    it('instantaneously recalculates macros when oil level is switched from light to heavy', () => {
      const initial: DetectedFoodItem = {
        id: 'item-dal',
        name: 'Dal Makhani',
        estimatedGrams: 150,
        cookingMethod: 'creamy_gravy',
        oilLevel: 'light',
        confidence: 0.9,
      };

      const lightItem = resolveFoodItem(initial);
      expect(lightItem.oilFatGramsAdded).toBe(2.5);

      // User taps "Heavy" (+10g) in segmented selector
      const heavyItem = recalculateItemNutrition(lightItem, 150, 'heavy');

      expect(heavyItem.oilLevel).toBe('heavy');
      expect(heavyItem.oilFatGramsAdded).toBe(10.0);

      // Fat delta must be exactly +7.5g (10.0g - 2.5g)
      const fatDelta = Number((heavyItem.fat - lightItem.fat).toFixed(1));
      expect(fatDelta).toBe(7.5);

      // Calorie delta must be exactly 7.5g * 9 = 67.5 -> 67 or 68 kcal
      const calorieDelta = heavyItem.calories - lightItem.calories;
      expect(calorieDelta).toBeGreaterThanOrEqual(67);
      expect(calorieDelta).toBeLessThanOrEqual(68);

      // Strict Atwater math holds
      const netCarbs = Math.max(0, heavyItem.carbs - heavyItem.fiber);
      const expectedCalories = Math.round(4 * heavyItem.protein + 4 * netCarbs + 9 * heavyItem.fat);
      expect(heavyItem.calories).toBe(expectedCalories);
    });
  });

  describe('4. Swarm Delegation & Backward Compatibility', () => {
    it('runVisionEngineSwarm throws honest error when no API keys are available for 503 handling', async () => {
      keyPoolRouter.reloadKeys('');

      await expect(
        runVisionEngineSwarm(
          'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          'dinner',
          'Homestyle dinner'
        )
      ).rejects.toThrow(/GEMINI_API_KEY is not configured/);
    });
  });
});
