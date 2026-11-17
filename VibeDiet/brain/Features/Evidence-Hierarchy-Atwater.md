# 🔬 Evidence Hierarchy & Atwater Engine

Linked: [[00-Home]] | [[Architecture]]

## Overview
VibeDiet rejects arbitrary calorie estimates by enforcing a strict 4-tier evidence hierarchy and deterministic Atwater general factor reconciliation across all meals.

## 4-Tier Nutritional Evidence Hierarchy
1. **Tier 1 (USDA / IFCT Foundation Data):** Laboratory-verified nutrient profiles with comprehensive micronutrient data.
2. **Tier 2 (Open Food Facts & Verified Barcode Registry):** Packaged product data validated with branded serving sizes and barcode GTIN identifiers.
3. **Tier 3 (Gemini 2.5 Vision Swarm):** Multi-agent visual decomposition and volumetric estimates with uncertainty tracking.
4. **Tier 4 (Natural Language Food Decomposer):** Rule-based component extraction (`naturalLanguageMealParser.ts`) mapping meal descriptions into staple ingredients.

## Atwater 4-9-4 Reconciliation (`src/shared/physics/atwater.ts`)
- **Mathematical Identity:** Total energy must strictly balance macro constituents:
  $$\text{Calories} = 4 \times \text{Protein (g)} + 4 \times \text{Carbs (g)} + 9 \times \text{Fat (g)} + 2 \times \text{Fiber (g)}$$
- **Confidence Intervals:** Every food item tracks $[\text{minCalories}, \text{maxCalories}]$. These intervals strictly bound point calories across all gram weight adjustments and serving scaling.
- **Zero-Residue Confirmation:** When converting drafts to final meals, rounding residues are eliminated without modifying individual food item macronutrients.
