# 📐 VibeDiet Architecture

## 1. Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Motion, Lucide Icons.
- **Backend:** Node.js 20+, Express, Helmet, CORS, express-rate-limit.
- **Serverless:** Netlify Functions v2 (`@netlify/functions`, TypeScript `.mts`), Netlify Database (`@netlify/database`).
- **AI / Vision Swarm:** `@google/genai` (Gemini 2.5 Flash / Pro) with multi-key rotation and cooldown router.
- **Offline / Packaging:** PWA ServiceWorker (`sw.js`), single-file zero-dependency bundle (`dist/VibeDiet-App.html`).

## 2. Database & Multi-Tenant Setup
- **Identity Isolation:** Browser-scoped local UID generation (`usr_<uuid>`) stored in `localStorage` (`vibediet_user_id`).
- **Production Store:** Netlify Postgres database (`vibe_users`, `vibe_meals`, `vibe_weights`, `vibe_days`, `vibe_biometrics`, `vibe_support_tickets`, `vibe_key_pool`).
- **Fallback / Local Store:** Tenant-partitioned file store (`.data/tenants/<uid>.json`) and browser `localStorage` (`vibediet_cache_v1`).

## 3. High-Level Data Flow
1. **Meal Ingestion:** Captured via Camera/Photo, natural language text prompt, or barcode scan.
2. **Pre-Processing:** Client canvas downscales images under 500KB (`imageCompressor.ts`); zero-fill memory buffers.
3. **Nutrient Resolution:** 4-Tier Hierarchy: Tier 1 USDA/IFCT -> Tier 2 Barcode -> Tier 3 Gemini Swarm -> Tier 4 Natural Decomposer.
4. **Atwater Reconciliation:** $4 \times \text{protein} + 4 \times \text{carbs} + 9 \times \text{fat} + 2 \times \text{fiber} \equiv \text{calories}$. Points strictly bound by $[\text{minCalories}, \text{maxCalories}]$.
5. **Adaptive Metabolism:** Weigh-ins smoothed via EWMA ($\alpha = 0.12$). TDEE adjusts targets with safety floors (1,200 kcal female, 1,500 kcal male).

## 4. Core Source File Map
- `src/App.tsx`: Central router, navigation tabs, hash routing (`#photo`, `#barcode`), and modal overlays.
- `src/components/DailyDiaryScreen.tsx`: Main diary dashboard, macro progress rings, meal cards, and date navigator.
- `src/components/PhotoLoggingScreen.tsx`: Image capture interface, client compression, and progressive draft status.
- `src/components/DraftReviewModal.tsx`: Interactive draft item editor, gram tuning, and Atwater recalculation.
- `src/components/MetabolismCoachScreen.tsx`: Adaptive TDEE dashboard, EWMA weight trend graph, and plateau logic.
- `src/components/AdminDashboardScreen.tsx`: Air-gapped administration cockpit for memory, key pool health, and telemetry.
- `src/context/AuthContext.tsx`: Browser-scoped user identity management (`usr_<uuid>`), Google demo, and admin auth.
- `src/context/DietContext.tsx`: Root diet state provider, local persistence, date handling, and offline queue flush.
- `src/shared/physics/atwater.ts`: 4-9-4 Atwater formula, confidence intervals, and calendar-safe `getLocalDateString`.
- `src/shared/physics/adaptiveTdee.ts`: Mifflin-St Jeor BMR, EWMA weight smoothing, and adaptive caloric target math.
- `src/services/geminiNutritionSwarm.ts`: Multi-agent Gemini vision reasoning pipeline with volumetric estimation.
- `src/services/keyPoolRouter.ts`: Multi-key rotation, cooldown management, and exponential backoff for Gemini API keys.
- `src/services/naturalLanguageMealParser.ts`: Deterministic decomposition engine for natural text meal descriptions.
- `src/services/offlineSyncQueue.ts`: Indexed/local offline mutation queue with automatic replay on reconnection.
- `server.ts`: Express application server with Helmet security, CORS origin gate, rate limiters, and static PWA.
- `src/routes/v1.ts`: Primary Express REST API router implementing auth, drafts, meals, weights, biometrics, and billing.
- `netlify/functions/v1.mts`: Netlify serverless consumer handler mirroring all `/v1/*` routes with Netlify DB integration.
- `netlify/functions/admin.mts`: Netlify serverless admin handler providing protected overview, telemetry, and table inspection.
