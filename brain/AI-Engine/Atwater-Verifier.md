# 🔬 Atwater Verifier

#ai-model

Linked: [[00-Home]] | [[Architecture]] | [[AI-Meal-Scan]] | [[Food-Search-Catalog]] | [[Gemini-Recognition-Swarm]] | [[Today-Dashboard]] | [[DietContext]] | [[Evidence-Hierarchy-Atwater]]

## Source Files
- `VibeDiet/src/shared/physics/atwater.ts`
- `VibeDiet/src/utils/atwater.ts`

## Ground-Truth 4-4-9-7 Invariant
Every food item from [[Gemini-Recognition-Swarm]], [[Food-Search-Catalog]], or manual entry passes through `normalizeFoodItem()` and `reconcileAtwaterMacros()`:

$$\text{Atwater kcal} = 4 \times \text{Protein (g)} + 4 \times \text{Carbs (g)} + 9 \times \text{Fat (g)} + 2 \times \text{Fiber (g)}$$

- **7% Tolerance Audit:** If a reported label or AI calorie value diverges from computed Atwater calories beyond the 7% threshold, `hasAtwaterDiscrepancy` is flagged and macro-reconciled ground-truth energy is enforced.
- **Confidence Bounds:** Guarantees $\text{minCalories} \le \text{calories} \le \text{maxCalories}$ across all gram and serving-multiplier adjustments.
- **4-Tier Evidence Hierarchy:** Tier 1 USDA/IFCT → Tier 2 Open Food Facts Barcode → Tier 3 Gemini Vision Swarm → Tier 4 Natural Language Decomposer.
- **Calendar Date Safety:** Exports `getLocalDateString()` (`en-CA`) used by [[DietContext]] and [[Today-Dashboard]] to prevent UTC midnight rollover bugs.
