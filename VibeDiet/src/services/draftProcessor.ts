import { mockDb } from '../lib/mockFirestore.js';
import { dataStore } from '../lib/dataStore.js';
import { ClarifyingQuestion, PhotoDraft } from '../shared/draftTypes.js';
import { FoodItemEntry } from '../types/index.js';
import { keyPoolRouter } from './keyPoolRouter.js';
import { DEMO_INDIAN_FUSION_QUESTIONS, buildDemoRecognizedItems } from '../data/mockData.js';
import { runGeminiNutritionSwarm, runTextMealNutritionSwarm } from './geminiNutritionSwarm.js';
import { getPortionCalibration } from './portionMemory.js';
import { normalizeFoodItem } from '../utils/atwater.js';

export { DEMO_INDIAN_FUSION_QUESTIONS, buildDemoRecognizedItems, runGeminiNutritionSwarm, runTextMealNutritionSwarm };

export async function recognizeMealWithGemini(
  imageBase64: string,
  _apiKey?: string
): Promise<{
  mealTitle: string;
  referenceAnchor: string;
  items: FoodItemEntry[];
  questions: ClarifyingQuestion[];
}> {
  return runGeminiNutritionSwarm(imageBase64);
}

export async function processDraft(uid: string, draftId: string): Promise<PhotoDraft | null> {
  const draft = await dataStore.getDraft(uid, draftId);
  if (!draft) return null;

  draft.status = 'processing';
  draft.stage = 'spatial_ocr';
  draft.updatedAt = new Date().toISOString();
  await dataStore.saveDraft(uid, draft);

  const hasLiveKeys = keyPoolRouter.hasConfiguredKeys();

  const handleStageChange = async (
    stage: 'spatial_ocr' | 'parallel_fats_grounding' | 'atwater_verified'
  ) => {
    draft.stage = stage;
    draft.updatedAt = new Date().toISOString();
    await dataStore.saveDraft(uid, draft);
  };

  if (hasLiveKeys && draft.imageBase64) {
    try {
      const swarmResult = await runGeminiNutritionSwarm(
        draft.imageBase64,
        draft.slot,
        draft.contextNote || draft.mealHint,
        handleStageChange
      );
      draft.mealTitle = swarmResult.mealTitle;
      draft.referenceAnchor = swarmResult.referenceAnchor;
      draft.scanMode = swarmResult.scanMode;
      draft.recognizedItems = swarmResult.items;
      draft.questions = swarmResult.questions;
      draft.isDemoMode = false;
      draft.stage = 'atwater_verified';
    } catch (err) {
      console.warn('[Gemini Swarm] Inference fallback triggered:', err);
      await handleStageChange('parallel_fats_grounding');
      draft.mealTitle =
        'Grilled Paneer / Chicken Tikka Bowl with Basmati Rice, Dal Makhani & Kachumber Salad';
      draft.referenceAnchor = 'indian_katori_150ml';
      draft.scanMode = 'plate_vision';
      draft.recognizedItems = buildDemoRecognizedItems();
      draft.questions = DEMO_INDIAN_FUSION_QUESTIONS.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o })),
      }));
      draft.isDemoMode = true;
      draft.stage = 'atwater_verified';
    }
  } else {
    // In demo / test mode, cycle through stages cleanly
    await handleStageChange('parallel_fats_grounding');
    draft.mealTitle =
      'Grilled Paneer / Chicken Tikka Bowl with Basmati Rice, Dal Makhani & Kachumber Salad';
    draft.referenceAnchor = 'indian_katori_150ml';
    draft.scanMode = 'plate_vision';
    draft.recognizedItems = buildDemoRecognizedItems();
    draft.questions = DEMO_INDIAN_FUSION_QUESTIONS.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o })),
    }));
    draft.isDemoMode = true;
    draft.stage = 'atwater_verified';
  }

  // Personal Portion Calibration Memory: Automatically ground to user's calibrated baseline if present
  draft.recognizedItems = draft.recognizedItems.map((item) => {
    const cal = getPortionCalibration(uid, item.name);
    if (cal && cal.calibratedGrams > 0) {
      const scale = cal.calibratedGrams / (item.grams || 100);
      return normalizeFoodItem({
        ...item,
        grams: cal.calibratedGrams,
        protein: Number((item.protein * scale).toFixed(1)),
        carbs: Number((item.carbs * scale).toFixed(1)),
        fat: Number((item.fat * scale).toFixed(1)),
        fiber: Number((item.fiber * scale).toFixed(1)),
        sugar: Number((item.sugar * scale).toFixed(1)),
        sodium: Math.round(item.sodium * scale),
        tier: 3,
        tierSource: 'Personal Portion Calibration Memory',
      });
    }
    return item;
  });

  draft.status = 'ready_for_review';
  draft.updatedAt = new Date().toISOString();
  await dataStore.saveDraft(uid, draft);

  return draft;
}

export async function processTextDraft(
  uid: string,
  draftId: string,
  mealDescription: string
): Promise<PhotoDraft | null> {
  const draft = await dataStore.getDraft(uid, draftId);
  if (!draft) return null;

  draft.status = 'processing';
  draft.updatedAt = new Date().toISOString();
  await dataStore.saveDraft(uid, draft);

  const hasLiveKeys = keyPoolRouter.hasConfiguredKeys();

  if (hasLiveKeys && mealDescription.trim().length > 0) {
    try {
      const swarmResult = await runTextMealNutritionSwarm(mealDescription, draft.slot);
      draft.mealTitle = swarmResult.mealTitle;
      draft.referenceAnchor = swarmResult.referenceAnchor;
      draft.recognizedItems = swarmResult.items;
      draft.questions = swarmResult.questions;
      draft.isDemoMode = false;
    } catch (err) {
      console.warn('[Gemini Text Swarm] Inference fallback triggered:', err);
      draft.mealTitle = 'Dictated Meal (Demo Fallback)';
      draft.referenceAnchor = 'indian_katori_150ml';
      draft.recognizedItems = buildDemoRecognizedItems();
      draft.questions = DEMO_INDIAN_FUSION_QUESTIONS.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o })),
      }));
      draft.isDemoMode = true;
    }
  } else {
    draft.mealTitle = 'Dictated Meal (Demo Mode)';
    draft.referenceAnchor = 'indian_katori_150ml';
    draft.recognizedItems = buildDemoRecognizedItems();
    draft.questions = DEMO_INDIAN_FUSION_QUESTIONS.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o })),
    }));
    draft.isDemoMode = true;
  }

  draft.status = 'ready_for_review';
  draft.updatedAt = new Date().toISOString();
  await dataStore.saveDraft(uid, draft);

  return draft;
}

export function sweepStalledDrafts(maxAgeMs = 10 * 60 * 1000): {
  scanned: number;
  recovered: number;
  expired: number;
} {
  const now = Date.now();
  const allDrafts = mockDb.getAllDraftsAcrossUsers();
  let recovered = 0;
  let expired = 0;

  for (const draft of allDrafts) {
    const createdMs = new Date(draft.createdAt).getTime();
    const age = now - createdMs;

    if ((draft.status === 'queued' || draft.status === 'processing') && age >= maxAgeMs) {
      if (age > 24 * 60 * 60 * 1000) {
        draft.status = 'expired';
        draft.imageBase64 = undefined;
        expired++;
      } else {
        draft.mealTitle = 'Recovered Meal Draft (Auto-Swept)';
        draft.referenceAnchor = 'indian_katori_150ml';
        draft.recognizedItems = buildDemoRecognizedItems();
        draft.questions = DEMO_INDIAN_FUSION_QUESTIONS;
        draft.status = 'ready_for_review';
        recovered++;
      }
      draft.updatedAt = new Date().toISOString();
    }
  }

  return {
    scanned: allDrafts.length,
    recovered,
    expired,
  };
}
