# 🧠 Gemini Recognition Swarm

#ai-model

Linked: [[00-Home]] | [[Architecture]] | [[Key-Pool-Router]] | [[Atwater-Verifier]] | [[AI-Meal-Scan]] | [[Admin-Console]] | [[Serverless-API]] | [[AI-Vision-Nutrition-Swarm]]

## Source Files
- `VibeDiet/src/services/geminiNutritionSwarm.ts`
- `VibeDiet/src/services/naturalLanguageMealParser.ts`
- `VibeDiet/src/services/draftProcessor.ts`

## Model Cascade & Fallback Architecture
```mermaid
flowchart LR
  IN["Photo / Hinglish Text Input"] --> KPR["Key-Pool-Router (8-slot)"]
  KPR --> M1["gemini-2.5-flash (Primary)"]
  M1 -- "429 / 503 / Error" --> M2["gemini-2.5-pro (Fallback 1)"]
  M2 -- "Fallback" --> M3["gemini-2.0-flash (Fallback 2)"]
  M3 -- "No Keys / Offline" --> NLP["naturalLanguageMealParser.ts"]
  M1 --> ATW["Atwater-Verifier (4-4-9-7)"]
  M2 --> ATW
  M3 --> ATW
  NLP --> ATW
```

## Responsibilities
- **4-Agent Visual & Text Pipeline:** Decomposes plate photos and English/Hinglish descriptions into discrete food items with gram mass estimates, oil/ghee clarifying questions, and Indian katori / reference anchor calibration.
- **Strict Ground-Truth Verification:** Every recognized item is passed through [[Atwater-Verifier]] (`normalizeFoodItem`) before reaching [[AI-Meal-Scan]] or [[DietContext]].
- **Telemetry Reporting:** Execution latency and request/error counts flow directly into [[Key-Pool-Router]], `vibe_key_pool`, `vibe_system_telemetry`, and [[Admin-Console]].
