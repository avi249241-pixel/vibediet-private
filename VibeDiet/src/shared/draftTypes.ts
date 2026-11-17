import { FoodItemEntry, MealSlot } from '../types/index.js';

export type DraftStatus =
  | 'queued'
  | 'processing'
  | 'ready_for_review'
  | 'confirmed'
  | 'failed'
  | 'expired';

export interface ClarifyingQuestionOption {
  id: string;
  label: string;
  calorieDelta: number;
  fatDeltaGrams: number;
  carbDeltaGrams: number;
  proteinDeltaGrams: number;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  targetItemId?: string;
  options: ClarifyingQuestionOption[];
  selectedOptionId?: string;
}

export interface PhotoDraft {
  id: string;
  uid: string;
  date: string;
  slot: MealSlot;
  status: DraftStatus;
  stage?: 'spatial_ocr' | 'parallel_fats_grounding' | 'atwater_verified';
  createdAt: string;
  updatedAt: string;
  imageBase64?: string; // Purged upon confirmation
  thumbnailDataUrl?: string; // 320px retained preview
  mealTitle?: string;
  referenceAnchor?: string;
  contextNote?: string;
  mealHint?: string;
  scanMode?: 'plate_vision' | 'nutrition_label_ocr';
  servingMultiplier?: number;
  recognizedItems: FoodItemEntry[];
  questions: ClarifyingQuestion[];
  isDemoMode: boolean;
  errorMessage?: string;
  confirmedMealId?: string;
}
