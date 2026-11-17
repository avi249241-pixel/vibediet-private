import { describe, it, expect, vi, beforeEach } from 'vitest';
import { keyPoolRouter } from '../src/services/keyPoolRouter.js';
import {
  runGeminiNutritionSwarm,
  runTextMealNutritionSwarm,
  runAgent4CriticAndSanity,
  SWARM_MODELS,
  getSwarmTelemetry,
} from '../src/services/geminiNutritionSwarm.js';
import { processDraft, processTextDraft } from '../src/services/draftProcessor.js';
import { dataStore } from '../src/lib/dataStore.js';
import { mockDb } from '../src/lib/mockFirestore.js';
import { normalizeFoodItem } from '../src/utils/atwater.js';
import { PhotoDraft } from '../src/shared/draftTypes.js';

const instantiatedKeys: string[] = [];
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    ThinkingLevel: {
      THINKING_LEVEL_UNSPECIFIED: 'THINKING_LEVEL_UNSPECIFIED',
      MINIMAL: 'MINIMAL',
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
    },
    GoogleGenAI: class MockGoogleGenAI {
      apiKey: string;
      models: { generateContent: typeof mockGenerateContent };

      constructor(options: { apiKey: string }) {
        this.apiKey = options.apiKey;
        instantiatedKeys.push(options.apiKey);
        this.models = { generateContent: mockGenerateContent };
      }
    },
  };
});

describe('Frontier 4-Agent Cloud Gemini Food-Recognition Swarm', () => {
  beforeEach(() => {
    mockDb.resetForTests();
    instantiatedKeys.length = 0;
    mockGenerateContent.mockReset();

    // Mock response handler branching on systemInstruction / model / prompt contents
    mockGenerateContent.mockImplementation(async ({ model, contents, config }: any) => {
      const userText = contents?.[0]?.parts?.map((p: any) => p.text).filter(Boolean).join(' ') || '';
      const sysInst = typeof config?.systemInstruction === 'string' ? config.systemInstruction : '';

      // 1. Text Decomposer Handler (Natural Language / Voice transcript input)
      if (sysInst.includes('Natural Language') || userText.includes('Decompose this meal description')) {
        return {
          text: JSON.stringify({
            mealTitle: 'Phulka Roti with Paneer Bhurji & Spiced Buttermilk',
            referenceAnchor: 'indian_katori_150ml',
            items: [
              {
                itemId: 'item-1',
                name: 'Phulka Roti with Ghee',
                volumeCm3: 65,
                densityGPerCm3: 0.92,
                grams: 60,
                cookingMethod: 'roasted with ghee',
                protein: 5.5,
                carbs: 29.5,
                fiber: 2.5,
                fat: 4.5,
                sugar: 0.5,
                sodium: 110,
                confidence: 0.96,
                cookingFatCategory: 'observable_moderate',
              },
              {
                itemId: 'item-2',
                name: 'Paneer Bhurji',
                volumeCm3: 140,
                densityGPerCm3: 1.07,
                grams: 150,
                cookingMethod: 'sauteed with onions and spices',
                protein: 22.0,
                carbs: 8.5,
                fiber: 1.5,
                fat: 24.0,
                sugar: 2.0,
                sodium: 490,
                confidence: 0.93,
                cookingFatCategory: 'unobservable_unknown',
              },
              {
                itemId: 'item-3',
                name: 'Spiced Buttermilk (Chaas)',
                volumeCm3: 200,
                densityGPerCm3: 1.0,
                grams: 200,
                cookingMethod: 'churned beverage',
                protein: 4.2,
                carbs: 6.2,
                fiber: 0.0,
                fat: 2.1,
                sugar: 5.5,
                sodium: 180,
                confidence: 0.98,
                cookingFatCategory: 'observable_low',
              },
            ],
          }),
        };
      }

      // 2. Agent 2: Hidden Fats & Clarifying Question Architect
      if (sysInst.includes('Agent 2') || userText.includes('Audit cooking fats')) {
        if (userText.includes('Paneer Bhurji') || userText.includes('Phulka Roti')) {
          return {
            text: JSON.stringify({
              fatAudits: [
                {
                  targetItemId: 'item-1',
                  itemName: 'Phulka Roti with Ghee',
                  cookingFatCategory: 'observable_moderate',
                },
                {
                  targetItemId: 'item-2',
                  itemName: 'Paneer Bhurji',
                  cookingFatCategory: 'unobservable_unknown',
                  fatNotes: 'Hidden cooking oil or desi ghee in bhurji',
                },
                {
                  targetItemId: 'item-3',
                  itemName: 'Spiced Buttermilk (Chaas)',
                  cookingFatCategory: 'observable_low',
                },
              ],
              questions: [
                {
                  id: 'q-paneer-fat',
                  targetItemId: 'item-2',
                  question: 'What cooking fat was used for the Paneer Bhurji?',
                  selectedOptionId: 'opt-paneer-std',
                  options: [
                    {
                      id: 'opt-paneer-light',
                      label: 'Light spray / homestyle (-40 kcal)',
                      calorieDelta: -40,
                      fatDeltaGrams: -4.5,
                      carbDeltaGrams: 0,
                      proteinDeltaGrams: 0,
                    },
                    {
                      id: 'opt-paneer-std',
                      label: 'Standard preparation (+0 kcal)',
                      calorieDelta: 0,
                      fatDeltaGrams: 0,
                      carbDeltaGrams: 0,
                      proteinDeltaGrams: 0,
                    },
                    {
                      id: 'opt-paneer-ghee',
                      label: 'Restaurant butter/ghee (+80 kcal)',
                      calorieDelta: 80,
                      fatDeltaGrams: 9.0,
                      carbDeltaGrams: 0,
                      proteinDeltaGrams: 0,
                    },
                  ],
                },
              ],
            }),
          };
        }

        // Default Photo meal Agent 2 output
        return {
          text: JSON.stringify({
            fatAudits: [
              {
                targetItemId: 'item-1',
                itemName: 'Steamed Long-Grain Basmati Rice',
                cookingFatCategory: 'observable_low',
              },
              {
                targetItemId: 'item-2',
                itemName: 'Epigamia Artisanal Greek Yogurt',
                cookingFatCategory: 'observable_low',
              },
              {
                targetItemId: 'item-3',
                itemName: 'Slow-Cooked Black Dal Makhani',
                cookingFatCategory: 'unobservable_unknown',
                fatNotes: 'Restaurant tadka likely with cream or desi ghee',
              },
            ],
            questions: [
              {
                id: 'q-dal-makhan',
                targetItemId: 'item-3',
                question: 'Was extra butter or desi ghee added to the Dal Makhani?',
                selectedOptionId: 'opt-std-dal',
                options: [
                  {
                    id: 'opt-homestyle',
                    label: 'Homestyle preparation (No extra butter) (-45 kcal)',
                    calorieDelta: -45,
                    fatDeltaGrams: -5.0,
                    carbDeltaGrams: 0,
                    proteinDeltaGrams: 0,
                  },
                  {
                    id: 'opt-std-dal',
                    label: 'Standard restaurant preparation (Baseline, +0 kcal)',
                    calorieDelta: 0,
                    fatDeltaGrams: 0,
                    carbDeltaGrams: 0,
                    proteinDeltaGrams: 0,
                  },
                  {
                    id: 'opt-rich-ghee',
                    label: 'Desi Ghee tadka finish (+110 kcal)',
                    calorieDelta: 110,
                    fatDeltaGrams: 12.0,
                    carbDeltaGrams: 0,
                    proteinDeltaGrams: 0,
                  },
                ],
              },
              {
                id: 'q-rice-oil',
                targetItemId: 'item-1',
                question: 'Was the basmati rice cooked plain or with cumin ghee tadka (Jeera Rice)?',
                selectedOptionId: 'opt-plain-rice',
                options: [
                  {
                    id: 'opt-plain-rice',
                    label: 'Steamed plain in water (+0 kcal)',
                    calorieDelta: 0,
                    fatDeltaGrams: 0,
                    carbDeltaGrams: 0,
                    proteinDeltaGrams: 0,
                  },
                  {
                    id: 'opt-jeera-tadka',
                    label: 'Ghee Tadka Jeera Rice (+65 kcal)',
                    calorieDelta: 65,
                    fatDeltaGrams: 7.0,
                    carbDeltaGrams: 0.5,
                    proteinDeltaGrams: 0,
                  },
                ],
              },
            ],
          }),
        };
      }

      // 3. Agent 3: Tier 1/2 Database & Atwater Grounder
      if (sysInst.includes('Agent 3') || userText.includes('ground against USDA')) {
        if (userText.includes('Paneer Bhurji') || userText.includes('Phulka Roti')) {
          return {
            text: JSON.stringify({
              groundedItems: [
                {
                  itemId: 'item-1',
                  name: 'Phulka Roti with Ghee',
                  grams: 60,
                  tier: 3,
                  tierSource: 'Gemini Multimodal AI Vision',
                  protein: 5.5,
                  carbs: 29.5,
                  fat: 4.5,
                  fiber: 2.5,
                  sugar: 0.5,
                  sodium: 110,
                  reportedCalories: 180,
                  confidence: 0.96,
                },
                {
                  itemId: 'item-2',
                  name: 'Paneer Bhurji',
                  grams: 150,
                  tier: 3,
                  tierSource: 'Gemini Multimodal AI Vision',
                  protein: 22.0,
                  carbs: 8.5,
                  fat: 24.0,
                  fiber: 1.5,
                  sugar: 2.0,
                  sodium: 490,
                  reportedCalories: 338,
                  confidence: 0.93,
                },
                {
                  itemId: 'item-3',
                  name: 'Spiced Buttermilk (Chaas)',
                  grams: 200,
                  tier: 1,
                  tierSource: 'USDA FoodData Central #170885',
                  fdcId: '170885',
                  protein: 4.2,
                  carbs: 6.2,
                  fat: 2.1,
                  fiber: 0.0,
                  sugar: 5.5,
                  sodium: 180,
                  reportedCalories: 60,
                  confidence: 0.98,
                },
              ],
            }),
          };
        }

        // Default photo meal Agent 3 output
        return {
          text: JSON.stringify({
            groundedItems: [
              {
                itemId: 'item-1',
                name: 'Rice, White, Long-Grain, Basmati, cooked',
                grams: 150,
                tier: 1,
                tierSource: 'USDA FoodData Central #169756',
                fdcId: '169756',
                protein: 4.3,
                carbs: 42.2,
                fat: 0.4,
                fiber: 0.6,
                sugar: 0.1,
                sodium: 15,
                reportedCalories: 195,
                confidence: 0.98,
              },
              {
                itemId: 'item-2',
                name: 'Epigamia Artisanal Greek Yogurt',
                grams: 90,
                tier: 2,
                tierSource: 'Gemini Vision OCR Label',
                protein: 7.5,
                carbs: 4.8,
                fat: 2.7,
                fiber: 0.0,
                sugar: 3.6,
                sodium: 45,
                reportedCalories: 75,
                confidence: 0.96,
              },
              {
                itemId: 'item-3',
                name: 'Slow-Cooked Black Dal Makhani',
                grams: 140,
                tier: 3,
                tierSource: 'Gemini Multimodal AI Vision',
                protein: 8.4,
                carbs: 19.5,
                fat: 9.8,
                fiber: 5.2,
                sugar: 1.8,
                sodium: 520,
                reportedCalories: 190,
                confidence: 0.85,
              },
            ],
          }),
        };
      }

      // 4. Agent 1: Visual Spatial Decomposer (gemini-3.1-pro-preview)
      if (model === SWARM_MODELS.agent1 || sysInst.includes('Agent 1')) {
        return {
          text: JSON.stringify({
            mealTitle: 'Tandoori Thali with Greek Yogurt & Dal Makhani',
            referenceAnchor: 'indian_katori_150ml',
            items: [
              {
                itemId: 'item-1',
                name: 'Steamed Long-Grain Basmati Rice',
                volumeCm3: 188,
                densityGPerCm3: 0.8,
                grams: 150,
                cookingMethod: 'steamed',
                protein: 4.3,
                carbs: 42.2,
                fiber: 0.6,
                fat: 0.4,
                sugar: 0.1,
                sodium: 15,
                confidence: 0.98,
                cookingFatCategory: 'observable_low',
              },
              {
                itemId: 'item-2',
                name: 'Epigamia Artisanal Greek Yogurt',
                volumeCm3: 85,
                densityGPerCm3: 1.06,
                grams: 90,
                cookingMethod: 'chilled cultured',
                protein: 7.5,
                carbs: 4.8,
                fiber: 0.0,
                fat: 2.7,
                sugar: 3.6,
                sodium: 45,
                confidence: 0.96,
                cookingFatCategory: 'observable_low',
                detectedPackagingOrLabel: {
                  isDetected: true,
                  brandOrProduct: 'Epigamia',
                  servingGrams: 90,
                  calories: 75,
                  protein: 7.5,
                  carbs: 4.8,
                  fat: 2.7,
                  fiber: 0.0,
                  sugar: 3.6,
                  sodium: 45,
                  barcode: '8901058000290',
                },
              },
              {
                itemId: 'item-3',
                name: 'Slow-Cooked Black Dal Makhani',
                volumeCm3: 135,
                densityGPerCm3: 1.04,
                grams: 140,
                cookingMethod: 'simmered with butter',
                protein: 8.4,
                carbs: 19.5,
                fiber: 5.2,
                fat: 9.8,
                sugar: 1.8,
                sodium: 520,
                confidence: 0.85,
                cookingFatCategory: 'unobservable_unknown',
              },
            ],
          }),
        };
      }

      return { text: '{}' };
    });
  });

  it('1. Extracts spatial scale anchor and classifies OCR packaging labels as Tier 2', async () => {
    keyPoolRouter.reloadKeys('key-agent1,key-agent2,key-agent3');

    const result = await runGeminiNutritionSwarm(
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...',
      'lunch'
    );

    expect(result).toBeDefined();
    expect(result.mealTitle).toBe('Tandoori Thali with Greek Yogurt & Dal Makhani');
    expect(result.referenceAnchor).toBe('indian_katori_150ml');
    expect(result.items.length).toBe(3);

    // Verify 3 distinct cloud calls (Agent 1, Agent 2, Agent 3; Agent 4 is 0ms local)
    expect(instantiatedKeys.length).toBe(3);
    expect(instantiatedKeys[0]).toBe('key-agent1');
    expect(instantiatedKeys[1]).toBe('key-agent2');
    expect(instantiatedKeys[2]).toBe('key-agent3');

    // Verify OCR Label Item classified as Tier 2
    const ocrItem = result.items.find((i) => i.id === 'item-2');
    expect(ocrItem).toBeDefined();
    expect(ocrItem?.tier).toBe(2);
    expect(ocrItem?.tierSource).toBe('Gemini Vision OCR Label');
    expect(ocrItem?.protein).toBe(7.5);
    expect(ocrItem?.calories).toBe(75);
    expect(ocrItem?.confidence).toBe(0.96);

    // Verify USDA Tier 1 Whole Food Grounding on Rice
    const riceItem = result.items.find((i) => i.id === 'item-1');
    expect(riceItem?.tier).toBe(1);
    expect(riceItem?.tierSource).toContain('USDA FoodData Central');
    expect(riceItem?.fdcId).toBe('169756');

    // Verify Agent 2 Clarifying Questions include targetItemId
    expect(result.questions.length).toBe(2);
    const dalQ = result.questions.find((q) => q.id === 'q-dal-makhan');
    expect(dalQ?.targetItemId).toBe('item-3');
    const riceQ = result.questions.find((q) => q.id === 'q-rice-oil');
    expect(riceQ?.targetItemId).toBe('item-1');

    // Verify Telemetry
    const telemetry = getSwarmTelemetry();
    expect(telemetry.models.agent3).toBe('gemini-2.5-flash');
    expect(telemetry.models.agent4).toBe('deterministic-physics-engine');
  });

  it('2. Enforces deterministic 0ms physics, volumetric clamping, macro mass bounds & IFCT calibration in Agent 4', () => {
    // Item A: Volumetric density overflow (250g in 100cm³ = 2.5 g/cm³ > 1.3 max density)
    const denseItem = normalizeFoodItem({
      id: 'dense-item-1',
      name: 'Compressed Food Block',
      grams: 250,
      volumeCm3: 100,
      protein: 20,
      carbs: 40,
      fat: 10,
      cookingFatCategory: 'observable_low',
    });

    // Item B: Volumetric density underflow (10g in 100cm³ = 0.1 g/cm³ < 0.3 min density)
    const sparseItem = normalizeFoodItem({
      id: 'sparse-item-2',
      name: 'Fluffy Puffed Snack',
      grams: 10,
      volumeCm3: 100,
      protein: 1,
      carbs: 5,
      fat: 0.5,
      cookingFatCategory: 'observable_low',
    });

    // Item C: Macro-to-gram overflow (60g P + 50g C + 20g F = 130g macros on 100g weight)
    // + IFCT Indian Dal fiber/sodium calibration (0g fiber on 140g Dal Makhani)
    const dalItem = normalizeFoodItem({
      id: 'dal-makhani-3',
      name: 'Restaurant Dal Makhani',
      grams: 140,
      protein: 10,
      carbs: 20,
      fat: 15,
      fiber: 0.5, // abnormally low fiber for black lentils
      sodium: 50, // abnormally low sodium for restaurant preparation
      cookingFatCategory: 'unobservable_unknown',
    });

    const t0 = performance.now();
    const sanitized = runAgent4CriticAndSanity([denseItem, sparseItem, dalItem]);
    const durationMs = performance.now() - t0;

    // 0ms execution verification
    expect(durationMs).toBeLessThan(15);

    // 1. Dense item clamped to volumeCm3 * 1.3 (100 * 1.3 = 130g)
    expect(sanitized[0].grams).toBe(130);
    expect(sanitized[0].densityGPerCm3).toBe(1.3);

    // 2. Sparse item clamped to volumeCm3 * 0.3 (100 * 0.3 = 30g)
    expect(sanitized[1].grams).toBe(30);
    expect(sanitized[1].densityGPerCm3).toBe(0.3);

    // 3. IFCT 2017 Dal Makhani calibration: fiber elevated to >= 2.8 * 1.4 = 3.9g, sodium >= 350 * 1.4 = 490mg
    expect(sanitized[2].fiber).toBeGreaterThanOrEqual(3.8);
    expect(sanitized[2].sodium).toBeGreaterThanOrEqual(490);

    // 4. Widened unobservable_unknown fat interval
    expect(sanitized[2].minCalories).toBeLessThanOrEqual(Math.round(sanitized[2].calories * 0.8));
    expect(sanitized[2].maxCalories).toBeGreaterThanOrEqual(Math.round(sanitized[2].calories * 1.2));
  });

  it('3. Gracefully falls back to isDemoMode = true when no API keys are configured', async () => {
    keyPoolRouter.reloadKeys('');
    expect(keyPoolRouter.hasConfiguredKeys()).toBe(false);

    const draftId = `draft-test-fallback-${Date.now()}`;
    const testDraft: PhotoDraft = {
      id: draftId,
      uid: 'user-fallback-test',
      date: '2026-11-13',
      slot: 'lunch',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...',
      recognizedItems: [],
      questions: [],
      isDemoMode: true,
    };

    await dataStore.saveDraft(testDraft.uid, testDraft);

    const processed = await processDraft(testDraft.uid, draftId);
    expect(processed).toBeDefined();
    expect(processed?.status).toBe('ready_for_review');
    expect(processed?.isDemoMode).toBe(true);
    expect(processed?.referenceAnchor).toBe('indian_katori_150ml');
    expect(processed?.recognizedItems.length).toBeGreaterThan(0);
    expect(processed?.questions.length).toBeGreaterThan(0);
    expect(processed?.questions[0].targetItemId).toBe('rec-dal-3');
  });

  it('4. Deconstructs natural language meal dictation with volumetric estimates and targeted clarifying questions', async () => {
    keyPoolRouter.reloadKeys('text-key-1,text-key-2,text-key-3');

    const result = await runTextMealNutritionSwarm(
      '2 medium phulka rotis with ghee, 150g paneer bhurji, and 1 glass buttermilk',
      'dinner'
    );

    expect(result).toBeDefined();
    expect(result.mealTitle).toBe('Phulka Roti with Paneer Bhurji & Spiced Buttermilk');
    expect(result.referenceAnchor).toBe('indian_katori_150ml');
    expect(result.items.length).toBe(3);

    // Check Paneer Bhurji
    const bhurji = result.items.find((i) => i.id === 'item-2');
    expect(bhurji).toBeDefined();
    expect(bhurji?.grams).toBe(150);
    expect(bhurji?.cookingFatCategory).toBe('unobservable_unknown');
    // Paneer bhurji should have widened bounds
    expect(bhurji?.minCalories).toBeLessThanOrEqual(Math.round(bhurji!.calories * 0.8));
    expect(bhurji?.maxCalories).toBeGreaterThanOrEqual(Math.round(bhurji!.calories * 1.2));

    // Check Phulka Roti with Ghee (flatbread fiber calibration)
    const roti = result.items.find((i) => i.id === 'item-1');
    expect(roti).toBeDefined();
    expect(roti?.fiber).toBeGreaterThanOrEqual(1.4);

    // Check Clarifying Question targeting item-2
    expect(result.questions.length).toBeGreaterThan(0);
    const paneerQ = result.questions.find((q) => q.targetItemId === 'item-2');
    expect(paneerQ).toBeDefined();
    expect(paneerQ?.id).toBe('q-paneer-fat');
    expect(paneerQ?.question).toContain('cooking fat');
  });

  it('5. Successfully processes a text meal draft via processTextDraft and saves to dataStore', async () => {
    keyPoolRouter.reloadKeys('live-key-alpha,live-key-beta');

    const draftId = `draft-text-test-${Date.now()}`;
    const testDraft: PhotoDraft = {
      id: draftId,
      uid: 'user-text-test',
      date: '2026-11-13',
      slot: 'dinner',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recognizedItems: [],
      questions: [],
      isDemoMode: false,
    };

    await dataStore.saveDraft(testDraft.uid, testDraft);

    const processed = await processTextDraft(
      testDraft.uid,
      draftId,
      '2 phulka rotis with ghee, 150g paneer bhurji, 1 glass buttermilk'
    );

    expect(processed).toBeDefined();
    expect(processed?.status).toBe('ready_for_review');
    expect(processed?.isDemoMode).toBe(false);
    expect(processed?.recognizedItems.length).toBe(3);
    expect(processed?.questions.length).toBeGreaterThan(0);
    expect(processed?.questions[0].targetItemId).toBe('item-2');

    // Verify it was persisted to dataStore
    const loaded = await dataStore.getDraft(testDraft.uid, draftId);
    expect(loaded?.status).toBe('ready_for_review');
    expect(loaded?.recognizedItems.length).toBe(3);
  });
});
