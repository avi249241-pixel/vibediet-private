# 🏗️ 02 — Architecture Decision Record & Mathematical Invariants

## ADR-001: Atwater General Factor Reconciliation (`src/utils/atwater.ts`)
- **Formula:**
  $$E_{\text{calc}} = 4P + 4\max(0, C - F_{\text{fiber}}) + 9F_{\text{fat}} + 7A_{\text{alc}}$$
- **Rule:** If $|E_{\text{reported}} - E_{\text{calc}}| / \max(1, E_{\text{calc}}) > 0.10$, mark `hasDiscrepancy = true` and adopt `Math.round(E_calc)` as the reconciled energy ground-truth while preserving `reportedCalories` for auditability.

## ADR-002: Exponentially Weighted Moving Average Bodyweight (`src/routes/v1.ts`)
- **Formula:**
  $$W_{\text{smooth}, t} = \alpha W_t + (1 - \alpha) W_{\text{smooth}, t-1}, \quad \alpha = 0.12$$
- **Rationale:** Filters out 1.0–2.5 kg daily glycogen/water/sodium noise while responding smoothly to genuine adipose/lean tissue changes over a 14-day window.

## ADR-003: 50-Key Gemini Swarm Router (`src/services/keyPoolRouter.ts`)
- Reads comma-separated keys from `process.env.GEMINI_API_KEYS` (or falls back to `GEMINI_API_KEY`).
- Rotates index in round-robin order (`(currentIndex + 1) % keys.length`).
- Quarantines any key returning HTTP 429 or `RESOURCE_EXHAUSTED` for `60_000` ms and immediately retries with the next healthy key.

## ADR-004: Frontier 4-Agent Parallel Cloud Gemini Swarm (`src/services/geminiNutritionSwarm.ts`)
- **Zero Local ML:** 100% cloud inference via `@google/genai` and `keyPoolRouter.executeWithRetry()`.
- **Agent 1 — Visual Spatial Decomposer & OCR Engine (`gemini-3.1-pro-preview`, `thinkingLevel: "medium"`):**
  - Detects physical scale anchor in image (`"standard_dinner_plate_26cm"`, `"indian_katori_150ml"`, etc.).
  - Estimates geometric volume (`volumeCm3`) and density (`densityGPerCm3`), deriving mass: $\text{grams} = \text{volumeCm3} \times \text{densityGPerCm3}$.
  - Reads nutrition facts tables & packaging via OCR, automatically classifying recognized packaged products as `tier: 2` (`tierSource: "Gemini Vision OCR Label"`).
  - Assigns deterministic item IDs (`item-1`, `item-2`, ...).
- **Agent 2 — Hidden Fats & Target-Bound Clarification Architect (`gemini-3.8-flash`):**
  - Binds each clarifying question directly to `targetItemId` of the relevant food item.
  - Updates only the targeted food item when answered in `POST /v1/drafts/:id/clarify` and `DietContext.tsx`.
- **Agent 3 — Tier 1/2 Database Grounder (`gemini-3.8-flash` + USDA FDC):**
  - Upgraded to `gemini-3.8-flash` using reallocated cloud API slot for faster, higher recall grounding.
  - Matches whole foods to USDA FDC (`tier: 1`), respecting Tier 2 OCR label ground truth.
- **Agent 4 — Deterministic Physics + IFCT Indian Density Engine (0ms TypeScript):**
  - Volumetric sanity ($0.3 \le \text{grams}/\text{volumeCm3} \le 1.3$).
  - Macro-to-gram physics ($P + C + F \le \text{grams} \times 1.05$).
  - IFCT 2017 Indian preparation calibration (minimum dal fiber $\ge 2.8\text{g}/100\text{g}$, restaurant gravy sodium $\ge 350\text{mg}/100\text{g}$, $\pm 20\%$ interval for unknown cooking fats).
