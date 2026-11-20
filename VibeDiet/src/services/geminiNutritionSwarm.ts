import { keyPoolRouter } from './keyPoolRouter.js';
import { CookingFatCategory, EvidenceTier, FoodItemEntry } from '../types/index.js';
import { ClarifyingQuestion } from '../shared/draftTypes.js';
import { normalizeFoodItem } from '../utils/atwater.js';
import { DEMO_INDIAN_FUSION_QUESTIONS, VERIFIED_USDA_FOODS } from '../data/mockData.js';
import { searchUsdaLive } from './connectionsHub.js';

export const SWARM_MODELS = {
  agent1: 'gemini-2.5-flash',
  agent2: 'gemini-2.5-flash',
  agent3: 'gemini-2.5-flash',
  agent4: 'deterministic-physics-engine',
} as const;

export const SWARM_FALLBACK_MODELS = {
  agent1: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  agent2: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  agent3: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  text: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
} as const;

export const SWARM_ACTIVE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const;

export interface SwarmTelemetry {
  models: {
    agent1: string;
    agent2: string;
    agent3: string;
    agent4: string;
    activeList: string[];
  };
  lastExecutionLatencyMs: number;
}

let lastSwarmLatencyMs = 0;

export function getSwarmTelemetry(): SwarmTelemetry {
  return {
    models: {
      agent1: SWARM_MODELS.agent1,
      agent2: SWARM_MODELS.agent2,
      agent3: SWARM_MODELS.agent3,
      agent4: SWARM_MODELS.agent4,
      activeList: [...SWARM_ACTIVE_MODELS],
    },
    lastExecutionLatencyMs: lastSwarmLatencyMs,
  };
}

export function setSwarmLastExecutionLatency(latencyMs: number): void {
  lastSwarmLatencyMs = Math.max(0, Math.round(latencyMs));
}

export interface DetectedPackagingOrLabel {
  isDetected: boolean;
  brandOrProduct?: string;
  servingGrams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  barcode?: string;
}

export interface DecomposedFoodItem {
  itemId: string;
  name: string;
  grams: number;
  volumeCm3?: number;
  densityGPerCm3?: number;
  cookingMethod: string;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  sugar: number;
  sodium: number;
  confidence: number;
  cookingFatCategory: CookingFatCategory;
  detectedPackagingOrLabel?: DetectedPackagingOrLabel;
}

export interface Agent1DecompositionOutput {
  mealTitle: string;
  referenceAnchor: string;
  scanMode?: 'plate_vision' | 'nutrition_label_ocr';
  items: DecomposedFoodItem[];
}

export interface ItemFatAudit {
  itemName: string;
  targetItemId?: string;
  cookingFatCategory: CookingFatCategory;
  fatNotes?: string;
}

export interface Agent2FatAndQuestionsOutput {
  fatAudits: ItemFatAudit[];
  questions: ClarifyingQuestion[];
}

export interface SwarmRecognitionResult {
  mealTitle: string;
  referenceAnchor: string;
  scanMode?: 'plate_vision' | 'nutrition_label_ocr';
  items: FoodItemEntry[];
  questions: ClarifyingQuestion[];
  telemetry: {
    latencyMs: number;
    agents: {
      agent1: string;
      agent2: string;
      agent3: string;
      agent4: string;
    };
  };
}

// -----------------------------------------------------------------------------
// AGENT 1: Visual Spatial Decomposer & OCR Engine (gemini-3.1-pro-preview, thinkingLevel: "medium")
// -----------------------------------------------------------------------------
const AGENT1_SYSTEM_INSTRUCTION = `You are Agent 1 (Visual Spatial Decomposer & Nutrition Label OCR) in the VibeDiet nutrition pipeline.
Deconstruct meal photos into discrete ingredients or packaged items with geometric volumetric scale calibration.
1. Physical Scale Anchor Detection & Scan Mode:
   - Identify the primary reference anchor in the photo: "standard_dinner_plate_26cm", "indian_katori_150ml", "tablespoon_15ml", "beverage_can_330ml", "palm_reference", "package_label", or "none".
   - Determine scanMode: "nutrition_label_ocr" if a packaged product or nutrition facts table is the focus; otherwise "plate_vision".
2. Decompose items and derive mass from geometry:
   - Assign deterministic itemId ("item-1", "item-2", ...).
   - Estimate volume in cm³ (volumeCm3) relative to the scale anchor.
   - Estimate density in g/cm³ (densityGPerCm3, typically 0.35 to 1.25 g/cm³).
   - Compute grams = Math.round(volumeCm3 * densityGPerCm3).
   - Separate thali components (rice, roti, dal, sabzi, protein, salad, chutneys).
3. Nutrition Facts Label & Packaging OCR:
   - If packaged goods, nutrition tables, or barcodes are visible, extract exact printed serving sizes, calories, and macros in detectedPackagingOrLabel.
   - For items with detected labels, set tier: 2 (Vision OCR Nutrition Label).
Return strictly valid JSON adhering to the provided schema.`;

const AGENT1_JSON_SCHEMA = {
  type: 'object',
  properties: {
    mealTitle: { type: 'string', description: 'Appetizing, descriptive meal title' },
    scanMode: {
      type: 'string',
      enum: ['plate_vision', 'nutrition_label_ocr'],
      description: 'Detected scan mode: plate vision vs nutrition label OCR',
    },
    referenceAnchor: {
      type: 'string',
      enum: [
        'standard_dinner_plate_26cm',
        'indian_katori_150ml',
        'tablespoon_15ml',
        'beverage_can_330ml',
        'palm_reference',
        'package_label',
        'none',
      ],
      description: 'Detected physical scale anchor reference in the photo',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: 'Deterministic item ID, e.g. item-1' },
          name: { type: 'string', description: 'Component name' },
          volumeCm3: { type: 'number', description: 'Estimated volume in cm³' },
          densityGPerCm3: { type: 'number', description: 'Physical density in g/cm³' },
          grams: { type: 'number', description: 'Portion weight in grams' },
          cookingMethod: { type: 'string', description: 'Visible cooking technique' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fiber: { type: 'number' },
          fat: { type: 'number' },
          sugar: { type: 'number' },
          sodium: { type: 'number' },
          confidence: { type: 'number' },
          cookingFatCategory: {
            type: 'string',
            enum: ['observable_low', 'observable_moderate', 'unobservable_unknown'],
          },
          detectedPackagingOrLabel: {
            type: 'object',
            properties: {
              isDetected: { type: 'boolean' },
              brandOrProduct: { type: 'string' },
              servingGrams: { type: 'number' },
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
              fiber: { type: 'number' },
              sugar: { type: 'number' },
              sodium: { type: 'number' },
              barcode: { type: 'string' },
            },
            required: ['isDetected'],
          },
        },
        required: [
          'itemId',
          'name',
          'grams',
          'cookingMethod',
          'protein',
          'carbs',
          'fiber',
          'fat',
          'sugar',
          'sodium',
          'confidence',
          'cookingFatCategory',
        ],
      },
    },
  },
  required: ['mealTitle', 'referenceAnchor', 'items'],
};

export async function runAgent1VisualDecomposer(
  cleanData: string,
  mimeType: string,
  mealHint: string | undefined,
  contextNote: string | undefined,
  apiKey: string,
  model: string = SWARM_MODELS.agent1
): Promise<Agent1DecompositionOutput> {
  const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const contextParts: string[] = [];
  if (mealHint) contextParts.push(`Meal slot/hint: ${mealHint}`);
  if (contextNote) contextParts.push(`User Cooking Context & Kitchen Notes: "${contextNote}"`);

  const promptText = `Decompose this meal into all individual food components with spatial scale calibration and OCR label reading.${
    contextParts.length > 0 ? ` [CONTEXT: ${contextParts.join(' | ')}]` : ''
  }`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType,
              data: cleanData,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: AGENT1_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: AGENT1_JSON_SCHEMA,
      ...(model.includes('gemini-3')
        ? {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel?.MEDIUM ?? ('MEDIUM' as any),
            },
          }
        : {}),
    },
  });

  const raw = response.text || '{}';
  const parsed = JSON.parse(raw);

  const mealTitle = String(parsed.mealTitle || 'AI Vision Recognized Meal');
  const referenceAnchor = String(parsed.referenceAnchor || 'none');
  const scanMode: 'plate_vision' | 'nutrition_label_ocr' =
    parsed.scanMode === 'nutrition_label_ocr' ? 'nutrition_label_ocr' : 'plate_vision';

  const items: DecomposedFoodItem[] = Array.isArray(parsed.items)
    ? parsed.items.map((i: any, idx: number) => {
        const itemId = String(i.itemId || `item-${idx + 1}`);
        const volumeCm3 = i.volumeCm3 != null ? Math.max(1, Number(i.volumeCm3)) : undefined;
        const densityGPerCm3 =
          i.densityGPerCm3 != null ? Number(Number(i.densityGPerCm3).toFixed(2)) : undefined;
        let grams = Math.max(1, Math.round(Number(i.grams) || 100));

        // If volume and density are estimated, derive grams geometrically
        if (volumeCm3 && densityGPerCm3 && !i.grams) {
          grams = Math.max(1, Math.round(volumeCm3 * densityGPerCm3));
        }

        const detectedLabel = i.detectedPackagingOrLabel?.isDetected
          ? {
              isDetected: true,
              brandOrProduct: i.detectedPackagingOrLabel.brandOrProduct,
              servingGrams: i.detectedPackagingOrLabel.servingGrams,
              calories: i.detectedPackagingOrLabel.calories,
              protein: i.detectedPackagingOrLabel.protein,
              carbs: i.detectedPackagingOrLabel.carbs,
              fat: i.detectedPackagingOrLabel.fat,
              fiber: i.detectedPackagingOrLabel.fiber,
              sugar: i.detectedPackagingOrLabel.sugar,
              sodium: i.detectedPackagingOrLabel.sodium,
              barcode: i.detectedPackagingOrLabel.barcode,
            }
          : undefined;

        return {
          itemId,
          name: String(i.name || 'Food item'),
          grams,
          volumeCm3,
          densityGPerCm3,
          cookingMethod: String(i.cookingMethod || 'cooked'),
          protein: Math.max(0, Number(i.protein) || 0),
          carbs: Math.max(0, Number(i.carbs) || 0),
          fiber: Math.max(0, Number(i.fiber) || 0),
          fat: Math.max(0, Number(i.fat) || 0),
          sugar: Math.max(0, Number(i.sugar) || 0),
          sodium: Math.max(0, Math.round(Number(i.sodium) || 0)),
          confidence: Math.min(1, Math.max(0, Number(i.confidence) || 0.85)),
          cookingFatCategory: (['observable_low', 'observable_moderate', 'unobservable_unknown'].includes(
            i.cookingFatCategory
          )
            ? i.cookingFatCategory
            : 'observable_low') as CookingFatCategory,
          detectedPackagingOrLabel: detectedLabel,
        };
      })
    : [];

  return { mealTitle, referenceAnchor, scanMode, items };
}

// -----------------------------------------------------------------------------
// AGENT 2: Hidden Fats & Clarifying Question Architect (gemini-3.8-flash)
// -----------------------------------------------------------------------------
const AGENT2_SYSTEM_INSTRUCTION = `You are Agent 2 (Hidden Fats & Clarifying Question Architect) in the VibeDiet cloud swarm.
Audit meal items for hidden cooking oils, ghee, butter, cream, or dressings.
1. Classify each item's cookingFatCategory as "observable_low", "observable_moderate", or "unobservable_unknown".
2. Formulate 2-3 targeted ClarifyingQuestion objects for the user.
3. CRITICAL: Every ClarifyingQuestion MUST include targetItemId bound to the exact itemId of the food item it pertains to (e.g. binding the rice portion question to the rice itemId, and the ghee/tadka question to the dal/curry itemId).
4. Provide exact macro options with calorieDelta, fatDeltaGrams, carbDeltaGrams, and proteinDeltaGrams.
5. One baseline option must have 0 deltas and be set as selectedOptionId.
Return strictly valid JSON matching the schema.`;

const AGENT2_JSON_SCHEMA = {
  type: 'object',
  properties: {
    fatAudits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          targetItemId: { type: 'string', description: 'Target itemId, e.g. item-1' },
          itemName: { type: 'string' },
          cookingFatCategory: {
            type: 'string',
            enum: ['observable_low', 'observable_moderate', 'unobservable_unknown'],
          },
          fatNotes: { type: 'string' },
        },
        required: ['itemName', 'cookingFatCategory'],
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          targetItemId: { type: 'string', description: 'Exact itemId of the relevant food item' },
          question: { type: 'string' },
          selectedOptionId: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                calorieDelta: { type: 'number' },
                fatDeltaGrams: { type: 'number' },
                carbDeltaGrams: { type: 'number' },
                proteinDeltaGrams: { type: 'number' },
              },
              required: ['id', 'label', 'calorieDelta', 'fatDeltaGrams', 'carbDeltaGrams', 'proteinDeltaGrams'],
            },
          },
        },
        required: ['id', 'targetItemId', 'question', 'options', 'selectedOptionId'],
      },
    },
  },
  required: ['fatAudits', 'questions'],
};

export async function runAgent2HiddenFats(
  mealTitle: string,
  items: DecomposedFoodItem[],
  apiKey: string,
  model: string = SWARM_MODELS.agent2,
  contextNote?: string
): Promise<Agent2FatAndQuestionsOutput> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const contextPrompt = contextNote
    ? `\nUser Cooking Context & Kitchen Notes: "${contextNote}" (Incorporate this user-provided cooking fat and ingredient detail into audits and delta questions)\n`
    : '';

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Meal: ${mealTitle}${contextPrompt}\nDecomposed items with deterministic itemIds:\n${JSON.stringify(
              items,
              null,
              2
            )}\nAudit cooking fats and generate 2-3 targeted clarifying questions with targetItemId set.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: AGENT2_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: AGENT2_JSON_SCHEMA,
    },
  });

  const raw = response.text || '{}';
  const parsed = JSON.parse(raw);

  const fatAudits: ItemFatAudit[] = Array.isArray(parsed.fatAudits)
    ? parsed.fatAudits.map((a: any) => ({
        itemName: String(a.itemName || ''),
        targetItemId: a.targetItemId ? String(a.targetItemId) : undefined,
        cookingFatCategory: (['observable_low', 'observable_moderate', 'unobservable_unknown'].includes(
          a.cookingFatCategory
        )
          ? a.cookingFatCategory
          : 'observable_low') as CookingFatCategory,
        fatNotes: a.fatNotes ? String(a.fatNotes) : undefined,
      }))
    : [];

  const questions: ClarifyingQuestion[] = Array.isArray(parsed.questions) && parsed.questions.length > 0
    ? parsed.questions.map((q: any, qIdx: number) => {
        // Fallback targetItemId: match by question text keywords or item index
        let targetItemId = q.targetItemId ? String(q.targetItemId) : undefined;
        if (!targetItemId && items.length > 0) {
          const matchedItem = items.find((it) =>
            q.question?.toLowerCase().includes(it.name.toLowerCase())
          );
          targetItemId = matchedItem ? matchedItem.itemId : items[Math.min(qIdx, items.length - 1)].itemId;
        }

        return {
          id: String(q.id || `q-swarm-${qIdx + 1}`),
          targetItemId,
          question: String(q.question || 'Cooking preparation detail:'),
          selectedOptionId: String(q.selectedOptionId || (q.options?.[0]?.id ?? 'opt-std')),
          options: Array.isArray(q.options)
            ? q.options.map((opt: any, optIdx: number) => ({
                id: String(opt.id || `opt-${optIdx + 1}`),
                label: String(opt.label || 'Standard Option'),
                calorieDelta: Number(opt.calorieDelta) || 0,
                fatDeltaGrams: Number(opt.fatDeltaGrams) || 0,
                carbDeltaGrams: Number(opt.carbDeltaGrams) || 0,
                proteinDeltaGrams: Number(opt.proteinDeltaGrams) || 0,
              }))
            : [],
        };
      })
    : DEMO_INDIAN_FUSION_QUESTIONS;

  return { fatAudits, questions };
}

// -----------------------------------------------------------------------------
// AGENT 3: Tier 1/2 Database & Atwater Grounder (gemini-3.8-flash + USDA FDC)
// -----------------------------------------------------------------------------
const AGENT3_SYSTEM_INSTRUCTION = `You are Agent 3 (Tier 1/2 Database & Atwater Grounder) in the VibeDiet cloud swarm.
Audit extracted meal items against USDA FoodData Central and Open Food Facts.
For whole foods and standard staple ingredients (e.g. plain rice, avocado, boiled egg, chicken breast, cucumber, plain paneer):
- Identify matching USDA FoodData Central whole food entries.
- Assign tier: 1 with tierSource: "USDA FoodData Central #<fdcId>".
- Scale baseline nutritional reference data to portion grams.
- For items with detected packaging or OCR labels, preserve tier: 2 with tierSource: "Gemini Vision OCR Label".
- For mixed prepared recipes without a single USDA whole food equivalent, retain tier: 3 with tierSource: "Gemini Multimodal AI Vision".
Return strictly valid JSON matching the schema.`;

const AGENT3_JSON_SCHEMA = {
  type: 'object',
  properties: {
    groundedItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          name: { type: 'string' },
          grams: { type: 'number' },
          tier: { type: 'integer', enum: [1, 2, 3] },
          tierSource: { type: 'string' },
          fdcId: { type: 'string' },
          barcode: { type: 'string' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          fiber: { type: 'number' },
          sugar: { type: 'number' },
          sodium: { type: 'number' },
          reportedCalories: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: ['name', 'grams', 'tier', 'tierSource', 'protein', 'carbs', 'fat', 'fiber', 'reportedCalories'],
      },
    },
  },
  required: ['groundedItems'],
};

function findLocalUsdaMatch(itemName: string): FoodItemEntry | undefined {
  const clean = itemName.toLowerCase();
  return VERIFIED_USDA_FOODS.find((v) => {
    const vName = v.name.toLowerCase();
    const keywords = clean.split(/\s+/).filter((w) => w.length > 3);
    return keywords.some((kw) => vName.includes(kw));
  });
}

export async function runAgent3DatabaseGrounder(
  items: DecomposedFoodItem[],
  apiKey: string,
  model: string = SWARM_MODELS.agent3
): Promise<FoodItemEntry[]> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Items to ground against USDA FDC / Open Food Facts:\n${JSON.stringify(
              items,
              null,
              2
            )}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: AGENT3_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: AGENT3_JSON_SCHEMA,
    },
  });

  const raw = response.text || '{}';
  const parsed = JSON.parse(raw);
  const candidateItems = Array.isArray(parsed.groundedItems) && parsed.groundedItems.length > 0
    ? parsed.groundedItems
    : items;

  const resultItems: FoodItemEntry[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const sourceDecomposed = items[idx];
    const rawGrounded = candidateItems[idx] || sourceDecomposed;
    const itemName = String(rawGrounded.name || sourceDecomposed.name || 'Food item');
    const grams = Math.max(1, Math.round(Number(rawGrounded.grams || sourceDecomposed.grams) || 100));

    // 1. Check if Agent 1 detected an OCR packaging/nutrition label
    if (sourceDecomposed.detectedPackagingOrLabel?.isDetected) {
      const label = sourceDecomposed.detectedPackagingOrLabel;
      const normalized = normalizeFoodItem({
        id: sourceDecomposed.itemId,
        name: itemName,
        grams: label.servingGrams ? Math.round(label.servingGrams) : grams,
        tier: 2,
        tierSource: 'Gemini Vision OCR Label',
        confidence: 0.96,
        reportedCalories: label.calories ?? rawGrounded.reportedCalories ?? 0,
        protein: label.protein ?? rawGrounded.protein ?? sourceDecomposed.protein,
        carbs: label.carbs ?? rawGrounded.carbs ?? sourceDecomposed.carbs,
        fat: label.fat ?? rawGrounded.fat ?? sourceDecomposed.fat,
        fiber: label.fiber ?? rawGrounded.fiber ?? sourceDecomposed.fiber,
        sugar: label.sugar ?? rawGrounded.sugar ?? sourceDecomposed.sugar,
        sodium: label.sodium ?? rawGrounded.sodium ?? sourceDecomposed.sodium,
        barcode: label.barcode,
        volumeCm3: sourceDecomposed.volumeCm3,
        densityGPerCm3: sourceDecomposed.densityGPerCm3,
        cookingFatCategory: sourceDecomposed.cookingFatCategory || 'observable_low',
      });
      resultItems.push(normalized);
      continue;
    }

    // 2. Check VERIFIED_USDA_FOODS local ground truth
    const usdaMatch = findLocalUsdaMatch(itemName);

    let tier: EvidenceTier = (Number(rawGrounded.tier) as EvidenceTier) || 3;
    let tierSource = String(rawGrounded.tierSource || 'Gemini Multimodal AI Vision');
    let fdcId: string | undefined = rawGrounded.fdcId ? String(rawGrounded.fdcId) : undefined;
    let confidence = Number(rawGrounded.confidence) || 0.85;

    let protein = Number(rawGrounded.protein ?? sourceDecomposed.protein) || 0;
    let carbs = Number(rawGrounded.carbs ?? sourceDecomposed.carbs) || 0;
    let fat = Number(rawGrounded.fat ?? sourceDecomposed.fat) || 0;
    let fiber = Number(rawGrounded.fiber ?? sourceDecomposed.fiber) || 0;
    let sugar = Number(rawGrounded.sugar ?? sourceDecomposed.sugar) || 0;
    let sodium = Number(rawGrounded.sodium ?? sourceDecomposed.sodium) || 0;
    let reportedCalories = Number(rawGrounded.reportedCalories) || 0;

    if (usdaMatch) {
      tier = 1;
      tierSource = usdaMatch.tierSource;
      fdcId = usdaMatch.fdcId;
      confidence = 0.99;
      const ratio = grams / usdaMatch.grams;
      protein = Number((usdaMatch.protein * ratio).toFixed(1));
      carbs = Number((usdaMatch.carbs * ratio).toFixed(1));
      fat = Number((usdaMatch.fat * ratio).toFixed(1));
      fiber = Number((usdaMatch.fiber * ratio).toFixed(1));
      sugar = Number((usdaMatch.sugar * ratio).toFixed(1));
      sodium = Math.round(usdaMatch.sodium * ratio);
      reportedCalories = Math.round(usdaMatch.calories * ratio);
    } else if (tier === 1 && !fdcId) {
      try {
        const live = await searchUsdaLive(itemName, 'DEMO_KEY');
        if (live?.foods?.length > 0) {
          const top = live.foods[0];
          fdcId = String(top.fdcId);
          tierSource = `USDA FoodData Central #${top.fdcId}`;
          confidence = 0.98;
        }
      } catch {
        tierSource = 'USDA FoodData Central';
      }
    }

    const normalized = normalizeFoodItem({
      id: sourceDecomposed.itemId,
      name: itemName,
      grams,
      tier,
      tierSource,
      confidence,
      reportedCalories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      fdcId,
      barcode: rawGrounded.barcode ? String(rawGrounded.barcode) : undefined,
      volumeCm3: sourceDecomposed.volumeCm3,
      densityGPerCm3: sourceDecomposed.densityGPerCm3,
      cookingFatCategory: sourceDecomposed.cookingFatCategory || 'observable_low',
    });

    resultItems.push(normalized);
  }

  return resultItems;
}

// -----------------------------------------------------------------------------
// AGENT 4: Deterministic Physics + IFCT Indian Density Engine (0ms TypeScript)
// -----------------------------------------------------------------------------
export function runAgent4CriticAndSanity(
  items: FoodItemEntry[]
): FoodItemEntry[] {
  const sanitized: FoodItemEntry[] = items.map((item) => {
    let grams = Math.max(1, Math.round(item.grams || 100));
    let volumeCm3 = item.volumeCm3;
    let densityGPerCm3 = item.densityGPerCm3;

    // 1. Volumetric Sanity: 0.3 <= grams / volumeCm3 <= 1.3
    if (volumeCm3 && volumeCm3 > 0) {
      const currentDensity = grams / volumeCm3;
      if (currentDensity < 0.3) {
        grams = Math.max(grams, Math.round(volumeCm3 * 0.3));
      } else if (currentDensity > 1.3) {
        grams = Math.min(grams, Math.round(volumeCm3 * 1.3));
      }
      densityGPerCm3 = Number((grams / volumeCm3).toFixed(2));
    }

    let protein = item.protein;
    let carbs = item.carbs;
    let fat = item.fat;
    let fiber = item.fiber;
    let sodium = item.sodium;

    // 2. Macro-to-Gram Physics: P + C + F <= grams * 1.05
    const maxMacroMass = Number((grams * 1.05).toFixed(1));
    const currentMacroMass = protein + carbs + fat;
    if (currentMacroMass > maxMacroMass && currentMacroMass > 0) {
      const scale = maxMacroMass / currentMacroMass;
      protein = Number((protein * scale).toFixed(1));
      carbs = Number((carbs * scale).toFixed(1));
      fat = Number((fat * scale).toFixed(1));
      while (Number((protein + carbs + fat).toFixed(1)) > maxMacroMass) {
        if (fat >= 0.1) {
          fat = Number((fat - 0.1).toFixed(1));
        } else if (carbs >= 0.1) {
          carbs = Number((carbs - 0.1).toFixed(1));
        } else if (protein >= 0.1) {
          protein = Number((protein - 0.1).toFixed(1));
        } else {
          break;
        }
      }
      if (fiber > carbs) {
        fiber = Number(carbs.toFixed(1));
      }
    }

    // 3. IFCT 2017 Indian Preparation Fiber/Sodium Calibration
    const lowerName = item.name.toLowerCase();
    const isLegumeDal = /dal|lentil|chhole|chana|rajma|sambar|kadhi/.test(lowerName);
    const isVegetableDish = /sabzi|bhindi|gobi|aloo|palak|paneer|curry|masala/.test(lowerName);
    const isFlatbread = /roti|chapati|naan|paratha|phulka/.test(lowerName);

    if (isLegumeDal) {
      const minDalFiber = Number((2.8 * (grams / 100)).toFixed(1));
      if (fiber < minDalFiber) {
        fiber = Math.min(carbs, minDalFiber);
      }
      const minDalSodium = Math.round(350 * (grams / 100));
      if (sodium < minDalSodium && item.cookingFatCategory !== 'observable_low') {
        sodium = minDalSodium;
      }
    } else if (isVegetableDish) {
      const minVegFiber = Number((1.8 * (grams / 100)).toFixed(1));
      if (fiber < minVegFiber) {
        fiber = Math.min(carbs, minVegFiber);
      }
    } else if (isFlatbread) {
      const minBreadFiber = Number((2.4 * (grams / 100)).toFixed(1));
      if (fiber < minBreadFiber) {
        fiber = Math.min(carbs, minBreadFiber);
      }
    }

    // 4. Reconcile with Atwater & calculate uncertainty bounds
    const normalized = normalizeFoodItem({
      ...item,
      grams,
      protein,
      carbs,
      fat,
      fiber,
      sodium,
      reportedCalories: item.reportedCalories,
      cookingFatCategory: item.cookingFatCategory,
      tier: item.tier,
      tierSource: item.tierSource,
      fdcId: item.fdcId,
      barcode: item.barcode,
      volumeCm3,
      densityGPerCm3,
    });

    // 5. Widened uncertainty interval for unobservable_unknown cooking fats
    if (normalized.cookingFatCategory === 'unobservable_unknown') {
      const minBound = Math.max(0, Math.round(normalized.calories * 0.8));
      const maxBound = Math.round(normalized.calories * 1.2);
      normalized.minCalories = Math.min(normalized.minCalories, minBound);
      normalized.maxCalories = Math.max(normalized.maxCalories, maxBound);
    }

    return normalized;
  });

  // 6. Meal total calorie bounds verification (20 to 3500 kcal)
  let totalMealCalories = sanitized.reduce((sum, i) => sum + i.calories, 0);
  if (totalMealCalories > 3500 && sanitized.length > 0) {
    const scale = 3500 / totalMealCalories;
    for (const item of sanitized) {
      item.grams = Math.max(1, Math.round(item.grams * scale));
      item.protein = Number((item.protein * scale).toFixed(1));
      item.carbs = Number((item.carbs * scale).toFixed(1));
      item.fat = Number((item.fat * scale).toFixed(1));
      item.fiber = Number((item.fiber * scale).toFixed(1));
      const recon = normalizeFoodItem(item);
      Object.assign(item, recon);
    }
  } else if (totalMealCalories < 20 && sanitized.length > 0) {
    sanitized[0].reportedCalories = Math.max(sanitized[0].reportedCalories, 20);
    const recon = normalizeFoodItem(sanitized[0]);
    Object.assign(sanitized[0], recon);
  }

  return sanitized;
}

// -----------------------------------------------------------------------------
// SWARM ORCHESTRATOR: 4-Agent Pipeline Routed Through keyPoolRouter
// -----------------------------------------------------------------------------
export async function runGeminiNutritionSwarm(
  imageBase64: string,
  mealHint?: string,
  contextNote?: string,
  onStageChange?: (stage: 'spatial_ocr' | 'parallel_fats_grounding' | 'atwater_verified') => void | Promise<void>
): Promise<SwarmRecognitionResult> {
  const startTime = Date.now();

  let mimeType = 'image/jpeg';
  let cleanData = imageBase64;
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    cleanData = parts[1];
  }

  // Stage 1: Spatial OCR & Anchor Detection
  if (onStageChange) {
    try {
      await onStageChange('spatial_ocr');
    } catch {}
  }

  // 1. Agent 1: Visual Spatial Decomposer (with fallback across gemini-3.1-pro-preview, gemini-3-flash-preview, gemini-3.5-flash)
  const agent1Output = await keyPoolRouter.executeWithModelFallback(
    [...SWARM_FALLBACK_MODELS.agent1],
    (key, model) => runAgent1VisualDecomposer(cleanData, mimeType, mealHint, contextNote, key, model)
  );

  // Stage 2: Parallel Hidden Fats & USDA/IFCT Grounding
  if (onStageChange) {
    try {
      await onStageChange('parallel_fats_grounding');
    } catch {}
  }

  // 2 & 3. Agent 2 & Agent 3 executed in true Promise.all parallel execution across rotated pool keys
  const [agent2Output, agent3Output] = await Promise.all([
    keyPoolRouter.executeWithModelFallback(
      [...SWARM_FALLBACK_MODELS.agent2],
      (key, model) => runAgent2HiddenFats(agent1Output.mealTitle, agent1Output.items, key, model, contextNote)
    ),
    keyPoolRouter.executeWithModelFallback(
      [...SWARM_FALLBACK_MODELS.agent3],
      (key, model) => runAgent3DatabaseGrounder(agent1Output.items, key, model)
    ),
  ]);

  // Stage 3: Atwater Physics & Verification
  if (onStageChange) {
    try {
      await onStageChange('atwater_verified');
    } catch {}
  }

  // Merge Agent 2 fat audits and detected packaging into Agent 3 grounded items
  const mergedItems: FoodItemEntry[] = agent3Output.map((item, idx) => {
    const origDecomp = agent1Output.items[idx];
    const audit = agent2Output.fatAudits.find(
      (a) =>
        (a.targetItemId && a.targetItemId === item.id) ||
        a.itemName.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(a.itemName.toLowerCase())
    );
    const cookingFatCategory: CookingFatCategory =
      audit?.cookingFatCategory || item.cookingFatCategory || 'observable_low';

    let tier: EvidenceTier = item.tier;
    let tierSource = item.tierSource;
    let grams = item.grams;
    let reportedCalories = item.reportedCalories;

    // Check if detected packaging OCR label
    if (origDecomp?.detectedPackagingOrLabel?.isDetected || agent1Output.scanMode === 'nutrition_label_ocr') {
      tier = 2;
      tierSource = 'Gemini Vision OCR Label';
      if (origDecomp?.detectedPackagingOrLabel?.servingGrams) {
        grams = origDecomp.detectedPackagingOrLabel.servingGrams;
      }
      if (origDecomp?.detectedPackagingOrLabel?.calories) {
        reportedCalories = origDecomp.detectedPackagingOrLabel.calories;
      }
    }

    return normalizeFoodItem({
      ...item,
      grams,
      tier,
      tierSource,
      reportedCalories,
      referenceAnchor: agent1Output.referenceAnchor,
      scanMode: agent1Output.scanMode,
      cookingFatCategory,
    });
  });

  // 4. Agent 4: Deterministic Physics + IFCT Indian Density Engine (0ms execution, zero LLM network calls)
  const sanitizedItems = runAgent4CriticAndSanity(mergedItems);

  const latencyMs = Date.now() - startTime;
  setSwarmLastExecutionLatency(latencyMs);

  const questions =
    agent2Output.questions && agent2Output.questions.length > 0
      ? agent2Output.questions
      : DEMO_INDIAN_FUSION_QUESTIONS;

  return {
    mealTitle: agent1Output.mealTitle || 'AI Vision Recognized Meal',
    referenceAnchor: agent1Output.referenceAnchor || 'none',
    scanMode: agent1Output.scanMode || 'plate_vision',
    items: sanitizedItems,
    questions,
    telemetry: {
      latencyMs,
      agents: {
        agent1: SWARM_MODELS.agent1,
        agent2: SWARM_MODELS.agent2,
        agent3: SWARM_MODELS.agent3,
        agent4: SWARM_MODELS.agent4,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// TEXT/VOICE MEAL DECOMPOSER (gemini-3.8-flash, cascading to gemini-3.1-pro-preview)
// -----------------------------------------------------------------------------
const TEXT_DECOMPOSER_SYSTEM_INSTRUCTION = `You are the Natural Language and Voice Transcript Meal Decomposer for VibeDiet.
Deconstruct natural-language meal descriptions or voice-dictated transcripts into discrete ingredients or food items with volumetric, gram, and macronutrient calibration.
1. Disaggregate multi-item descriptions (e.g. rotis, rice, dal, curry, paneer, chicken, sides, beverages, desserts).
2. Estimate portion grams, volume in cm³ (volumeCm3), and density in g/cm³ (densityGPerCm3) based on standard culinary serving sizes, Indian household measures (katori, cup, spoon, piece, glass), or explicit user statements.
3. Identify cookingMethod and cookingFatCategory ("observable_low", "observable_moderate", or "unobservable_unknown").
4. Provide realistic macronutrients (protein, carbs, fiber, fat, sugar, sodium).
5. Assign deterministic itemId ("item-1", "item-2", ...).
6. Infer an appropriate referenceAnchor (e.g. "indian_katori_150ml", "standard_dinner_plate_26cm", "tablespoon_15ml", "beverage_can_330ml", or "none").
Return strictly valid JSON adhering to the provided schema.`;

const TEXT_DECOMPOSER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    mealTitle: { type: 'string', description: 'Descriptive meal title' },
    referenceAnchor: {
      type: 'string',
      enum: [
        'standard_dinner_plate_26cm',
        'indian_katori_150ml',
        'tablespoon_15ml',
        'beverage_can_330ml',
        'none',
      ],
      description: 'Inferred physical scale anchor reference',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: 'Deterministic item ID, e.g. item-1' },
          name: { type: 'string', description: 'Component name' },
          volumeCm3: { type: 'number', description: 'Estimated volume in cm³' },
          densityGPerCm3: { type: 'number', description: 'Physical density in g/cm³' },
          grams: { type: 'number', description: 'Portion weight in grams' },
          cookingMethod: { type: 'string', description: 'Cooking technique or state' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fiber: { type: 'number' },
          fat: { type: 'number' },
          sugar: { type: 'number' },
          sodium: { type: 'number' },
          confidence: { type: 'number' },
          cookingFatCategory: {
            type: 'string',
            enum: ['observable_low', 'observable_moderate', 'unobservable_unknown'],
          },
        },
        required: [
          'itemId',
          'name',
          'grams',
          'cookingMethod',
          'protein',
          'carbs',
          'fiber',
          'fat',
          'sugar',
          'sodium',
          'confidence',
          'cookingFatCategory',
        ],
      },
    },
  },
  required: ['mealTitle', 'referenceAnchor', 'items'],
};

export async function runTextMealDecomposer(
  mealDescription: string,
  slotHint: string | undefined,
  apiKey: string,
  model = 'gemini-2.5-flash'
): Promise<Agent1DecompositionOutput> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const promptText = `Decompose this meal description or voice transcript into all individual food components with volumetric and macro estimates.${
    slotHint ? ` Meal context/slot: ${slotHint}` : ''
  }\nMeal description: "${mealDescription}"`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }],
      },
    ],
    config: {
      systemInstruction: TEXT_DECOMPOSER_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseJsonSchema: TEXT_DECOMPOSER_JSON_SCHEMA,
    },
  });

  const raw = response.text || '{}';
  const parsed = JSON.parse(raw);

  const mealTitle = String(parsed.mealTitle || 'Dictated Meal');
  const referenceAnchor = String(parsed.referenceAnchor || 'indian_katori_150ml');

  const items: DecomposedFoodItem[] = Array.isArray(parsed.items)
    ? parsed.items.map((i: any, idx: number) => {
        const itemId = String(i.itemId || `item-${idx + 1}`);
        const volumeCm3 = i.volumeCm3 != null ? Math.max(1, Number(i.volumeCm3)) : undefined;
        const densityGPerCm3 =
          i.densityGPerCm3 != null ? Number(Number(i.densityGPerCm3).toFixed(2)) : undefined;
        let grams = Math.max(1, Math.round(Number(i.grams) || 100));

        if (volumeCm3 && densityGPerCm3 && !i.grams) {
          grams = Math.max(1, Math.round(volumeCm3 * densityGPerCm3));
        }

        return {
          itemId,
          name: String(i.name || 'Food item'),
          grams,
          volumeCm3,
          densityGPerCm3,
          cookingMethod: String(i.cookingMethod || 'prepared'),
          protein: Math.max(0, Number(i.protein) || 0),
          carbs: Math.max(0, Number(i.carbs) || 0),
          fiber: Math.max(0, Number(i.fiber) || 0),
          fat: Math.max(0, Number(i.fat) || 0),
          sugar: Math.max(0, Number(i.sugar) || 0),
          sodium: Math.max(0, Math.round(Number(i.sodium) || 0)),
          confidence: Math.min(1, Math.max(0, Number(i.confidence) || 0.9)),
          cookingFatCategory: (['observable_low', 'observable_moderate', 'unobservable_unknown'].includes(
            i.cookingFatCategory
          )
            ? i.cookingFatCategory
            : 'observable_low') as CookingFatCategory,
        };
      })
    : [];

  const scanMode: 'plate_vision' | 'nutrition_label_ocr' = 'plate_vision';
  return { mealTitle, referenceAnchor, scanMode, items };
}

export async function runTextMealNutritionSwarm(
  mealDescription: string,
  slotHint?: string
): Promise<SwarmRecognitionResult> {
  const startTime = Date.now();

  // 1. Text Decomposer: gemini-3.8-flash with fallback to gemini-3-flash-preview, gemini-3.5-flash, gemini-3.1-pro-preview
  const textDecomposed = await keyPoolRouter.executeWithModelFallback(
    [...SWARM_FALLBACK_MODELS.text],
    (key, model) => runTextMealDecomposer(mealDescription, slotHint, key, model)
  );

  // 2 & 3. Agent 2 & Agent 3 executed in parallel via Promise.all across rotated pool keys
  const [agent2Output, agent3Output] = await Promise.all([
    keyPoolRouter.executeWithModelFallback(
      [...SWARM_FALLBACK_MODELS.agent2],
      (key, model) => runAgent2HiddenFats(textDecomposed.mealTitle, textDecomposed.items, key, model)
    ),
    keyPoolRouter.executeWithModelFallback(
      [...SWARM_FALLBACK_MODELS.agent3],
      (key, model) => runAgent3DatabaseGrounder(textDecomposed.items, key, model)
    ),
  ]);

  // Merge Agent 2 fat audits into Agent 3 grounded items
  const mergedItems: FoodItemEntry[] = agent3Output.map((item) => {
    const audit = agent2Output.fatAudits.find(
      (a) =>
        (a.targetItemId && a.targetItemId === item.id) ||
        a.itemName.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(a.itemName.toLowerCase())
    );
    const cookingFatCategory: CookingFatCategory =
      audit?.cookingFatCategory || item.cookingFatCategory || 'observable_low';

    return normalizeFoodItem({
      ...item,
      cookingFatCategory,
    });
  });

  // 4. Agent 4: Deterministic Physics + IFCT Indian Density Engine
  const sanitizedItems = runAgent4CriticAndSanity(mergedItems);

  const latencyMs = Date.now() - startTime;
  setSwarmLastExecutionLatency(latencyMs);

  const questions =
    agent2Output.questions && agent2Output.questions.length > 0
      ? agent2Output.questions
      : DEMO_INDIAN_FUSION_QUESTIONS;

  return {
    mealTitle: textDecomposed.mealTitle || 'AI Dictated Meal',
    referenceAnchor: textDecomposed.referenceAnchor || 'indian_katori_150ml',
    items: sanitizedItems,
    questions,
    telemetry: {
      latencyMs,
      agents: {
        agent1: 'gemini-2.5-flash',
        agent2: SWARM_MODELS.agent2,
        agent3: SWARM_MODELS.agent3,
        agent4: SWARM_MODELS.agent4,
      },
    },
  };
}
