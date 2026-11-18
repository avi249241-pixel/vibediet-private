# 🧭 VibeDiet Connected Neural Brain

#hub

Welcome to the **VibeDiet 2.1** connected Obsidian knowledge graph. Every UI screen, AI model cascade, Atwater verifier, EWMA metabolic engine, serverless endpoint, and PostgreSQL table is bi-directionally linked so Graph View renders a unified neural network with zero orphan nodes.

---

## 🏛️ Hub & System Maps

- 📐 **[[Architecture]]** — Full-stack architecture, data pipelines, and core file map.
- ⚡ **[[Active-Context]]** — Current engineering focus, active files, and live deployment state.
- 🕸️ **[[Code-Graph]]** — Auto-synced AST/import dependency graph & file-to-note index (`npm run brain:sync`).
- 🔄 **[[DietContext]]** — Client state hub connecting UI views, `localStorage`, offline queue, and `/v1/*`.

---

## 🤖 AI & Math Engine (`brain/AI-Engine/`)

- 🧠 **[[Gemini-Recognition-Swarm]]** — `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.0-flash` vision & Hinglish text cascade.
- 🔑 **[[Key-Pool-Router]]** — 8-slot round-robin rotation, 60s HTTP 429 cooldowns, and live `vibe_key_pool` telemetry.
- 🔬 **[[Atwater-Verifier]]** — 4-4-9-7 calorie ground-truth invariant, 4-tier evidence hierarchy, and macro reconciliation.
- ⚖️ **[[Adaptive-TDEE-EWMA]]** — Mifflin-St Jeor BMR + EWMA ($\alpha = 0.12$) smoothing + 1,200/1,500 kcal physiological floors.

---

## 📱 Core App Features (`brain/Features/`)

- ✨ **[[Today-Dashboard]]** — Luminous calorie ring, per-date hydration, 4 meal cards, Smart Macro Solver, dark-glass dock.
- 📸 **[[AI-Meal-Scan]]** — Photo upload, clipboard paste, English/Hinglish parser, 1.5× serving scaler, progressive stages.
- 🔍 **[[Food-Search-Catalog]]** — Tier 1 USDA/IFCT search, Tier 2 Open Food Facts barcode scanner, custom Atwater entry.
- 🧬 **[[Metabolism-Coach]]** — Adaptive TDEE dashboard, EWMA trend chart, Weekly Autopilot Check-In modal.
- 👤 **[[Profile-and-Support]]** — Biometric targets, GDPR/DPDP JSON/CSV export, full erasure, billing, Support Desk.
- 🛡️ **[[Admin-Console]]** — Air-gapped telemetry cockpit, live key pool metrics, DB table inspector, Support Inbox.

### Deep-Dive Reference Notes
- [[AI-Vision-Nutrition-Swarm]] · [[Adaptive-Metabolism-Coach]] · [[Evidence-Hierarchy-Atwater]]

---

## ⚙️ Backend & Database (`brain/Backend/` & `brain/Database/`)

- 🌐 **[[Serverless-API]]** — Complete `/v1/*` and `/v1/admin/*` route map across `netlify/functions/v1.mts`, `admin.mts`, and `src/routes/v1.ts`.
- 🗄️ **[[PostgreSQL-Schema]]** — Multi-tenant `vibe_*` relational schema (`vibe_users`, `vibe_key_pool`, `vibe_meals`, `vibe_day_summaries`, `vibe_weights`, `vibe_biometrics`, `vibe_support_tickets`, `vibe_audit_logs`, `vibe_system_telemetry`).
