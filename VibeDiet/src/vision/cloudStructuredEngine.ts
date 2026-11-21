import { keyPoolRouter } from '../services/keyPoolRouter.js';
import {
  CookingMethod,
  DetectedFoodItem,
  OilLevel,
  VisionEngine,
  VisionEngineInput,
  VisionEngineProvider,
  VisionEngineResult,
} from './types.js';

export const CLOUD_VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
] as const;

export const CLOUD_VISION_SYSTEM_INSTRUCTION = `You are the Cloud Structured Vision Engine for VibeDiet.
Your sole responsibility is spatial visual identification of meals, portion mass estimation anchored to visible culinary scale references, cooking technique, and surface oil/ghee sheen level.

STRICT SAFETY RESTRICTIONS:
- DO NOT calculate, guess, predict, or output calories, protein, carbs, fat, fiber, or any macronutrients under any circumstances.
- All nutritional grounding and Atwater physics calculations are performed downstream by the deterministic nutrition resolver.

1. Physical Scale Anchor Detection:
   - Identify the primary reference anchor in the image: "standard_dinner_plate_26cm", "indian_katori_150ml", "tablespoon_15ml", "beverage_can_330ml", "palm_reference", "package_label", or "none".
2. Discrete Food Deconstruction:
   - Deconstruct the meal into discrete items (e.g. separate flatbreads, rice, lentils, curries, protein, salad, condiments).
   - Estimate the portion mass in grams relative to the reference anchor.
3. Cooking Method Classification:
   - Must be one of: "steamed", "boiled", "tawa_roasted", "sauteed", "deep_fried", "creamy_gravy".
4. Surface Oil / Ghee Sheen Assessment:
   - "none": Dry, boiled, or steamed with zero visible fat sheen.
   - "light": Minimal sheen, dry-roasted, or light oil mist (~0.5 tsp added fat).
   - "standard": Standard homestyle curry, tadka, or buttering (~1.0 tsp added fat).
   - "heavy": High surface sheen, deep-fried, restaurant gravy, or floating oil pool (~2.0 tsp added fat).
5. Output: Return strictly valid JSON matching the schema with concise property names.`;

export const CLOUD_VISION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Appetizing, descriptive meal title' },
    anchor: {
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
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Visual food component name' },
          grams: { type: 'number', description: 'Portion weight in grams relative to anchor' },
          method: {
            type: 'string',
            enum: ['steamed', 'boiled', 'tawa_roasted', 'sauteed', 'deep_fried', 'creamy_gravy'],
          },
          oil: {
            type: 'string',
            enum: ['none', 'light', 'standard', 'heavy'],
          },
          conf: { type: 'number', description: 'Visual confidence between 0.0 and 1.0' },
        },
        required: ['name', 'grams', 'method', 'oil', 'conf'],
      },
    },
  },
  required: ['title', 'anchor', 'items'],
};

const VALID_COOKING_METHODS = new Set<CookingMethod>([
  'steamed',
  'boiled',
  'tawa_roasted',
  'sauteed',
  'deep_fried',
  'creamy_gravy',
]);

const VALID_OIL_LEVELS = new Set<OilLevel>(['none', 'light', 'standard', 'heavy']);

export class CloudStructuredVisionEngine implements VisionEngine {
  readonly provider: VisionEngineProvider = 'cloud-structured';

  async analyzeMealImage(input: VisionEngineInput): Promise<VisionEngineResult> {
    const startTime = Date.now();

    if (!keyPoolRouter.hasConfiguredKeys()) {
      throw new Error('Gemini AI recognition is unavailable because GEMINI_API_KEY is not configured.');
    }

    let mimeType = input.mimeType || 'image/jpeg';
    let cleanData = input.imageBase64;
    if (cleanData.includes(';base64,')) {
      const parts = cleanData.split(';base64,');
      mimeType = parts[0].replace('data:', '') || mimeType;
      cleanData = parts[1];
    }

    const contextParts: string[] = [];
    if (input.mealHint) contextParts.push(`Meal slot/hint: ${input.mealHint}`);
    if (input.contextNote) contextParts.push(`User context: "${input.contextNote}"`);

    const promptText = `Identify all discrete food components, estimate portion mass in grams relative to scale reference, classify cooking method, and assess oil/ghee sheen.${
      contextParts.length > 0 ? ` [CONTEXT: ${contextParts.join(' | ')}]` : ''
    }`;

    const rawResponse = await keyPoolRouter.executeWithModelFallback(
      [...CLOUD_VISION_MODELS],
      async (key, model) => {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: key });

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
            systemInstruction: CLOUD_VISION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: CLOUD_VISION_JSON_SCHEMA,
          },
        });

        return response.text || '{}';
      }
    );

    let parsed: any;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (err) {
      throw new Error(`Failed to parse structured vision output from Gemini: ${String(err)}`);
    }

    const mealTitle = String(parsed.title || 'AI Vision Recognized Meal');
    const referenceAnchor = String(parsed.anchor || 'none');

    const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    const items: DetectedFoodItem[] = rawItems.map((item, idx) => {
      const methodStr = String(item.method || '').toLowerCase() as CookingMethod;
      const cookingMethod: CookingMethod = VALID_COOKING_METHODS.has(methodStr)
        ? methodStr
        : 'sauteed';

      const oilStr = String(item.oil || '').toLowerCase() as OilLevel;
      const oilLevel: OilLevel = VALID_OIL_LEVELS.has(oilStr) ? oilStr : 'standard';

      const confidence =
        typeof item.conf === 'number'
          ? Math.max(0, Math.min(1, Number(item.conf.toFixed(2))))
          : 0.85;

      return {
        id: `food-item-${idx + 1}`,
        name: String(item.name || `Food Component ${idx + 1}`),
        estimatedGrams: Math.max(1, Math.round(Number(item.grams) || 100)),
        cookingMethod,
        oilLevel,
        confidence,
        referenceAnchor,
        visualNotes: `${cookingMethod} with ${oilLevel} oil sheen`,
      };
    });

    const latencyMs = Date.now() - startTime;

    return {
      mealTitle,
      referenceAnchor,
      items,
      engineProvider: this.provider,
      latencyMs,
      rawResponse,
    };
  }
}
