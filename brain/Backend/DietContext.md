# 🔄 DietContext & Client State Hub

#backend #ui

Linked: [[00-Home]] | [[Architecture]] | [[Code-Graph]] | [[Serverless-API]] | [[PostgreSQL-Schema]] | [[Today-Dashboard]] | [[AI-Meal-Scan]] | [[Food-Search-Catalog]] | [[Metabolism-Coach]] | [[Profile-and-Support]]

## Source Files
- `VibeDiet/src/context/DietContext.tsx`
- `VibeDiet/src/context/AuthContext.tsx`
- `VibeDiet/src/services/offlineSyncQueue.ts`

## Core Responsibilities
- **Identity Isolation (`AuthContext.tsx`):** Generates persistent browser-scoped `usr_<uuid>` tokens (`localStorage['vibediet_user_id']`) so each visitor gets an isolated tenant partition in [[PostgreSQL-Schema]].
- **Per-Date State (`waterByDate` & `meals`):** Stores hydration strictly per calendar date (`getLocalDateString()` in `en-CA` format), defaulting any unlogged date strictly to `0 ml`.
- **Optimistic Server Reconciliation:** `addManualMeal()` reconciles optimistic client meal IDs with server-returned IDs and deduplicates by semantic fingerprint during `syncFromBackend()`.
- **AI Draft Orchestration:** `startPhotoDraft()` and `startTextDraft()` call `POST /v1/ai/analyze` ([[Serverless-API]]), apply [[Atwater-Verifier]] normalization, and commit scaled drafts with largest-remainder calorie allocation via `confirmActiveDraft(multiplier)`.
- **Offline-First Resilience:** Failed `POST /v1/meals/manual` and `POST /v1/days/:date/water` calls enqueue into `offlineSyncQueue.ts` and flush automatically on `window.online`.
