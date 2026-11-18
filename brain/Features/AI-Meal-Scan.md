# 📸 AI Meal Scan

#feature #ui

Linked: [[00-Home]] | [[Architecture]] | [[DietContext]] | [[Gemini-Recognition-Swarm]] | [[Key-Pool-Router]] | [[Atwater-Verifier]] | [[Today-Dashboard]] | [[Admin-Console]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/components/PhotoLogScreen.tsx`
- `VibeDiet/src/components/redesign/VibeDietAiScannerView.tsx`
- `VibeDiet/src/utils/imageCompressor.ts`
- `VibeDiet/src/services/portionMemory.ts`

## End-to-End Pipeline
```mermaid
flowchart LR
  SCAN["VibeDietAiScannerView (Photo / Hinglish Text)"] --> API["POST /v1/ai/analyze"]
  API --> KPR["Key-Pool-Router"]
  KPR --> SWARM["Gemini-Recognition-Swarm"]
  SWARM --> ATW["Atwater-Verifier (4-4-9-7)"]
  ATW --> DC["DietContext.confirmActiveDraft(mult)"]
  DC --> DB["vibe_meals + vibe_day_summaries"]
  KPR --> TEL["vibe_key_pool + vibe_system_telemetry -> Admin-Console"]
```

## State Hooks, API Endpoints & Database Tables
- **Context:** `useDiet()` ([[DietContext]]) for `activeDraft`, `startPhotoDraft`, `startTextDraft`, `confirmActiveDraft(multiplier)` (with largest-remainder exact calorie allocation).
- **API ([[Serverless-API]]):** `POST /v1/ai/analyze`, `POST /v1/drafts`, `POST /v1/drafts/text`, `GET /v1/drafts/:id`, `POST /v1/drafts/:id/confirm`, `POST /v1/meals/manual`.
- **Database ([[PostgreSQL-Schema]]):** `vibe_meals`, `vibe_day_summaries`, `vibe_portion_calibrations`, `vibe_key_pool`, `vibe_system_telemetry`.
