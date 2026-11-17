import { FoodItemEntry, MealSlot } from '../types/index.js';
import { ClarifyingQuestion, PhotoDraft } from '../shared/draftTypes.js';
import { normalizeFoodItem } from '../utils/atwater.js';

interface FoodTemplate {
  keywords: string[];
  name: string;
  defaultGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
  sodiumPer100g: number;
  tierSource: string;
  cookingFatCategory?: 'observable_low' | 'observable_moderate' | 'unobservable_unknown';
}

const FOOD_DICTIONARY: FoodTemplate[] = [
  {
    keywords: ['boiled egg', 'boiled eggs', 'hard boiled egg', 'soft boiled egg', 'egg', 'eggs', 'poached egg'],
    name: 'Whole Eggs (Boiled / Poached)',
    defaultGrams: 100, // ~2 large eggs
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    fiberPer100g: 0.0,
    sugarPer100g: 0.4,
    sodiumPer100g: 142,
    tierSource: 'USDA FoodData Central #171287',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['toast', 'toasted bread', 'sourdough', 'bread', 'slice of bread', 'slices of bread', 'multigrain'],
    name: 'Sourdough / Whole Wheat Toast',
    defaultGrams: 65, // ~2 slices
    caloriesPer100g: 245,
    proteinPer100g: 8.5,
    carbsPer100g: 48.0,
    fatPer100g: 1.5,
    fiberPer100g: 3.8,
    sugarPer100g: 2.5,
    sodiumPer100g: 340,
    tierSource: 'USDA FoodData Central #169756',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['chicken', 'chicken breast', 'grilled chicken', 'baked chicken'],
    name: 'Grilled Chicken Breast, Skinless',
    defaultGrams: 150,
    caloriesPer100g: 165,
    proteinPer100g: 31.0,
    carbsPer100g: 0.0,
    fatPer100g: 3.6,
    fiberPer100g: 0.0,
    sugarPer100g: 0.0,
    sodiumPer100g: 74,
    tierSource: 'USDA FoodData Central #171477',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['rice', 'basmati', 'white rice', 'brown rice', 'steamed rice'],
    name: 'Steamed Long-Grain Basmati Rice',
    defaultGrams: 150,
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    fiberPer100g: 0.4,
    sugarPer100g: 0.1,
    sodiumPer100g: 1,
    tierSource: 'USDA FoodData Central #169756',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['dal', 'lentils', 'dal tadka', 'yellow dal', 'moong dal'],
    name: 'Home-Style Dal Tadka (Yellow Lentils)',
    defaultGrams: 160,
    caloriesPer100g: 94,
    proteinPer100g: 6.0,
    carbsPer100g: 13.5,
    fatPer100g: 3.3,
    fiberPer100g: 3.2,
    sugarPer100g: 1.2,
    sodiumPer100g: 320,
    tierSource: 'IFCT / USDA #1102901',
    cookingFatCategory: 'observable_moderate',
  },
  {
    keywords: ['dal makhani', 'makhani'],
    name: 'Slow-Simmered Dal Makhani',
    defaultGrams: 160,
    caloriesPer100g: 135,
    proteinPer100g: 5.8,
    carbsPer100g: 14.2,
    fatPer100g: 6.5,
    fiberPer100g: 3.5,
    sugarPer100g: 1.5,
    sodiumPer100g: 450,
    tierSource: 'USDA FoodData Central',
    cookingFatCategory: 'unobservable_unknown',
  },
  {
    keywords: ['paneer', 'cottage cheese', 'paneer tikka'],
    name: 'Fresh Paneer / Cottage Cheese',
    defaultGrams: 100,
    caloriesPer100g: 296,
    proteinPer100g: 18.3,
    carbsPer100g: 3.4,
    fatPer100g: 22.8,
    fiberPer100g: 0.0,
    sugarPer100g: 2.6,
    sodiumPer100g: 18,
    tierSource: 'USDA FoodData Central #746782',
    cookingFatCategory: 'observable_moderate',
  },
  {
    keywords: ['roti', 'rotis', 'chapati', 'chapatis', 'phulka', 'phulkas'],
    name: 'Whole Wheat Phulka Roti',
    defaultGrams: 70, // 2 rotis
    caloriesPer100g: 250,
    proteinPer100g: 8.5,
    carbsPer100g: 48.0,
    fatPer100g: 2.2,
    fiberPer100g: 7.0,
    sugarPer100g: 1.0,
    sodiumPer100g: 120,
    tierSource: 'IFCT / USDA #1102902',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['oatmeal', 'oats', 'porridge', 'rolled oats'],
    name: 'Rolled Oats Porridge / Oatmeal',
    defaultGrams: 180,
    caloriesPer100g: 83,
    proteinPer100g: 3.1,
    carbsPer100g: 15.0,
    fatPer100g: 1.4,
    fiberPer100g: 2.2,
    sugarPer100g: 0.6,
    sodiumPer100g: 4,
    tierSource: 'USDA FoodData Central #173904',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['banana', 'bananas'],
    name: 'Fresh Banana, Raw',
    defaultGrams: 118, // 1 medium
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    fiberPer100g: 2.6,
    sugarPer100g: 12.2,
    sodiumPer100g: 1,
    tierSource: 'USDA FoodData Central #173944',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['apple', 'apples'],
    name: 'Fresh Apple with Skin',
    defaultGrams: 150, // 1 medium
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 13.8,
    fatPer100g: 0.2,
    fiberPer100g: 2.4,
    sugarPer100g: 10.4,
    sodiumPer100g: 1,
    tierSource: 'USDA FoodData Central #171688',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['greek yogurt', 'yogurt', 'curd', 'dahi'],
    name: 'Greek Yogurt, Non-Fat Natural',
    defaultGrams: 150,
    caloriesPer100g: 59,
    proteinPer100g: 10.0,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    fiberPer100g: 0.0,
    sugarPer100g: 3.2,
    sodiumPer100g: 36,
    tierSource: 'USDA FoodData Central #171304',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['whey', 'protein powder', 'protein shake', 'whey protein'],
    name: 'Whey Protein Isolate Shake',
    defaultGrams: 32, // 1 scoop
    caloriesPer100g: 375,
    proteinPer100g: 78.0,
    carbsPer100g: 6.2,
    fatPer100g: 4.7,
    fiberPer100g: 0.0,
    sugarPer100g: 3.1,
    sodiumPer100g: 160,
    tierSource: 'USDA FoodData Central',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['salad', 'kachumber', 'cucumbers', 'cucumber', 'tomatoes'],
    name: 'Fresh Cucumber Tomato Garden Salad',
    defaultGrams: 120,
    caloriesPer100g: 22,
    proteinPer100g: 1.0,
    carbsPer100g: 4.5,
    fatPer100g: 0.2,
    fiberPer100g: 1.5,
    sugarPer100g: 2.5,
    sodiumPer100g: 25,
    tierSource: 'USDA FoodData Central #169228',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['avocado', 'avocados'],
    name: 'Hass Avocado, Sliced',
    defaultGrams: 60, // half avocado
    caloriesPer100g: 160,
    proteinPer100g: 2.0,
    carbsPer100g: 8.5,
    fatPer100g: 14.7,
    fiberPer100g: 6.7,
    sugarPer100g: 0.7,
    sodiumPer100g: 7,
    tierSource: 'USDA FoodData Central #171705',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['peanut butter', 'pb'],
    name: 'Natural Peanut Butter',
    defaultGrams: 16, // 1 tbsp
    caloriesPer100g: 588,
    proteinPer100g: 25.1,
    carbsPer100g: 20.0,
    fatPer100g: 50.4,
    fiberPer100g: 6.0,
    sugarPer100g: 9.0,
    sodiumPer100g: 420,
    tierSource: 'USDA FoodData Central #174266',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['salmon', 'fish', 'grilled salmon'],
    name: 'Atlantic Salmon Fillet, Grilled',
    defaultGrams: 140,
    caloriesPer100g: 208,
    proteinPer100g: 22.0,
    carbsPer100g: 0.0,
    fatPer100g: 13.4,
    fiberPer100g: 0.0,
    sugarPer100g: 0.0,
    sodiumPer100g: 59,
    tierSource: 'USDA FoodData Central #175168',
    cookingFatCategory: 'observable_low',
  },
  {
    keywords: ['dosa', 'masala dosa'],
    name: 'Crispy Masala Dosa with Potato Masala',
    defaultGrams: 180,
    caloriesPer100g: 168,
    proteinPer100g: 3.9,
    carbsPer100g: 28.5,
    fatPer100g: 4.8,
    fiberPer100g: 2.5,
    sugarPer100g: 1.2,
    sodiumPer100g: 360,
    tierSource: 'IFCT / USDA Database',
    cookingFatCategory: 'observable_moderate',
  },
];

function extractQuantityMultiplier(text: string, keyword: string): number {
  const lower = text.toLowerCase();
  // Look for patterns like "2 eggs", "3 slices of toast", "200g chicken", "half avocado"
  const idx = lower.indexOf(keyword);
  if (idx > 0) {
    const preceding = lower.slice(Math.max(0, idx - 15), idx).trim();
    if (preceding.endsWith('2') || preceding.endsWith('two')) return 2;
    if (preceding.endsWith('3') || preceding.endsWith('three')) return 3;
    if (preceding.endsWith('4') || preceding.endsWith('four')) return 4;
    if (preceding.endsWith('1') || preceding.endsWith('one')) return 1;
    if (preceding.includes('half')) return 0.5;
    if (preceding.includes('large')) return 1.3;
    if (preceding.includes('small')) return 0.7;
  }
  return 1;
}

export function parseNaturalLanguageMeal(
  description: string,
  slotHint: MealSlot = 'lunch',
  userUid = 'user-local'
): PhotoDraft {
  const lowerDesc = description.toLowerCase().trim();
  const matchedTemplates: Array<{ template: FoodTemplate; multiplier: number }> = [];

  // Match against known dictionary
  for (const template of FOOD_DICTIONARY) {
    for (const kw of template.keywords) {
      // Word boundary match
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerDesc)) {
        // Prevent duplicate templates
        if (!matchedTemplates.some((m) => m.template.name === template.name)) {
          const mult = extractQuantityMultiplier(lowerDesc, kw);
          matchedTemplates.push({ template, multiplier: mult });
        }
        break;
      }
    }
  }

  // Fallback if no specific keyword matched: create a sensible custom entry from the input text
  if (matchedTemplates.length === 0) {
    const words = description.trim().split(/\s+/).slice(0, 5).join(' ');
    matchedTemplates.push({
      template: {
        keywords: [lowerDesc],
        name: words || 'Custom Meal',
        defaultGrams: 200,
        caloriesPer100g: 135,
        proteinPer100g: 8.5,
        carbsPer100g: 14.0,
        fatPer100g: 4.5,
        fiberPer100g: 2.0,
        sugarPer100g: 1.5,
        sodiumPer100g: 250,
        tierSource: 'Smart Natural Language Parser',
        cookingFatCategory: 'observable_low',
      },
      multiplier: 1,
    });
  }

  // Convert matched templates into normalized food entries
  const recognizedItems: FoodItemEntry[] = matchedTemplates.map(({ template, multiplier }, idx) => {
    const grams = Math.max(1, Math.round(template.defaultGrams * multiplier));
    const factor = grams / 100;
    return normalizeFoodItem({
      id: `parsed-item-${idx + 1}-${Date.now()}`,
      name: template.name,
      grams,
      tier: 1,
      tierSource: template.tierSource,
      confidence: 0.95,
      reportedCalories: Math.round(template.caloriesPer100g * factor),
      protein: Number((template.proteinPer100g * factor).toFixed(1)),
      carbs: Number((template.carbsPer100g * factor).toFixed(1)),
      fat: Number((template.fatPer100g * factor).toFixed(1)),
      fiber: Number((template.fiberPer100g * factor).toFixed(1)),
      sugar: Number((template.sugarPer100g * factor).toFixed(1)),
      sodium: Math.round(template.sodiumPer100g * factor),
      cookingFatCategory: template.cookingFatCategory || 'observable_low',
    });
  });

  // Generate context-aware clarifying questions
  const questions: ClarifyingQuestion[] = [];
  if (recognizedItems.some((i) => i.name.includes('Egg') || i.name.includes('Chicken') || i.name.includes('Paneer'))) {
    const targetItem = recognizedItems.find((i) => i.name.includes('Egg') || i.name.includes('Chicken') || i.name.includes('Paneer'))!;
    questions.push({
      id: 'q-oil-clarification',
      question: `How was the ${targetItem.name.split(' ')[0]} prepared?`,
      targetItemId: targetItem.id,
      options: [
        {
          id: 'opt-minimal-oil',
          label: 'Dry Roasted / Boiled / Air-Fried (Minimal Fat)',
          calorieDelta: 0,
          fatDeltaGrams: 0,
          carbDeltaGrams: 0,
          proteinDeltaGrams: 0,
        },
        {
          id: 'opt-butter-oil',
          label: 'Cooked in Butter or Olive Oil (+5g Fat / ~45 kcal)',
          calorieDelta: 45,
          fatDeltaGrams: 5,
          carbDeltaGrams: 0,
          proteinDeltaGrams: 0,
        },
      ],
      selectedOptionId: 'opt-minimal-oil',
    });
  }

  const mealTitle = description.length > 5 ? description : recognizedItems.map((i) => i.name).join(' & ');

  return {
    id: `draft-nl-${Date.now()}`,
    uid: userUid,
    date: new Date().toLocaleDateString('en-CA'),
    slot: slotHint,
    status: 'ready_for_review',
    stage: 'atwater_verified',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mealTitle,
    referenceAnchor: 'plate_vision_calibrated',
    recognizedItems,
    questions,
    isDemoMode: false,
    servingMultiplier: 1.0,
  };
}
