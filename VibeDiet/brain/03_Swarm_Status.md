# 🤖 03 — Multi-Agent Swarm Status & Support Triage Matrix

## 1. Frontier 4-Agent Cloud Food-Recognition Swarm (`src/services/geminiNutritionSwarm.ts`)
| Agent | Role | Model | Routing | Key Responsibilities |
| :--- | :--- | :--- | :---: | :--- |
| **Agent 1** | Visual Spatial Decomposer & OCR Engine | `gemini-3.1-pro-preview` (`medium` thinking) | Rotated Key Slot | Spatial scale anchors (`indian_katori_150ml`), volume/density geometry, Nutrition Facts OCR (`tier: 2`), deterministic itemIds |
| **Agent 2** | Hidden Fats & Targeted Clarification Architect | `gemini-3.8-flash` | Parallel Key Slot (`Promise.all`) | Cooking fat audit, targeted clarifying questions bound to exact `targetItemId` with macro deltas |
| **Agent 3** | Tier 1/2 Database & Atwater Grounder | `gemini-3.8-flash` + USDA FDC | Parallel Key Slot (`Promise.all`) | Reallocated cloud slot; matches whole foods to USDA FDC (`tier: 1`), preserves Tier 2 OCR label ground truth |
| **Agent 4** | Deterministic Physics & IFCT Density Engine | `deterministic-physics-engine` (0ms) | In-Memory (Zero LLM) | Volumetric sanity ($0.3 \le \rho \le 1.3$), macro-to-gram physics ($P+C+F \le 1.05g$), IFCT 2017 Indian fiber/sodium calibration |

## 2. Telemetry & Support Ticket Matrix (`POST /v1/support`, `GET /v1/admin/overview`)
- `nutrition_fix`: Routed to Tier 1/Tier 2 verification queue for USDA/Barcode override.
- `bug`: Logged with client build version and draft ID for sweeper diagnosis.
- `account`: Handled with strict adherence to Ephemeral Photo Privacy & Erasure rules (`imageBase64` purged on confirm).
- `feedback`: Aggregated for product roadmap prioritization.
- `admin_overview`: Exposes active swarm models (`gemini-3.1-pro-preview`, `gemini-3.8-flash`), RSS (< 45MB), and `lastExecutionLatencyMs`.
