# VibeDiet Master Architectural Plan & Blueprint

## 1. Core Architecture Pillars
1. **Zero-Blank-Screen Local & Cloud Hybrid:** Works 100% offline via `dist/VibeDiet-App.html` or connected to the Express v1 API (`server.ts`) backed by Firestore / `MockFirestore`.
2. **4-Tier Nutrition Evidence Engine:**
   - **Tier 1 (`T1 Verified`):** USDA FoodData Central Foundation & SR Legacy Foods (95-99% confidence).
   - **Tier 2 (`T2 Barcode`):** Open Food Facts verified packaged barcode registry (90-95% confidence).
   - **Tier 3 (`T3 AI Vision`):** Gemini 3.1 Pro multi-modal decomposition with density modeling (75-85% confidence).
   - **Tier 4 (`T4 User Estimate`):** Manual entry or unverified restaurant estimate (50-70% confidence).
3. **Atwater 4-4-9-7 Reconciliation:**
   - $\text{Calculated kcal} = 4P + 4(\max(0, C - \text{Fiber})) + 9F + 7\text{Alcohol}$.
   - Preserves reported calories within $\pm 10\%$ tolerance; flags discrepancy and enforces Atwater ground-truth when deviation exceeds $10\%$.
4. **50-Key Gemini Swarm Router (`src/services/keyPoolRouter.ts`):**
   - Round-robin load balancing across up to 50 Google AI Pro keys (`gemini-3.1-pro-preview` & `gemini-3.8-flash`).
   - Automatic 60-second cooldown quarantine on HTTP 429 / `RESOURCE_EXHAUSTED` with transparent retry.
5. **Adaptive Metabolic Engine:**
   - Mifflin-St Jeor BMR + activity multiplier baseline.
   - Exponentially Weighted Moving Average ($\alpha = 0.12$) bodyweight smoothing.
   - Rolling 14-day True Expended TDEE calibration ($7700\text{ kcal/kg}$ tissue equivalence) with plateau refeed detection.
