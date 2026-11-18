# ⚡ Active Context

#hub

Linked: [[00-Home]] | [[Architecture]] | [[Code-Graph]] | [[DietContext]] | [[Serverless-API]] | [[PostgreSQL-Schema]] | [[AI-Meal-Scan]] | [[Admin-Console]] | [[Profile-and-Support]]

## Current Focus
Strip-to-Core, P0 Security Hardening & UTC/Math Parity Complete:
1. **P0 Security Hardening:** Eliminated all `'admin-token'`, `'guest-non-admin-token'`, `AIza*`, and `AQ.*` backdoors across `netlify/functions/admin.mts`, `src/middleware/auth.ts`, `src/context/AuthContext.tsx`, and `src/components/AdminDashboardScreen.tsx`. Admin routes strictly verify timing-safe `ADMIN_ACCESS_TOKEN` or cryptographically signed HMAC-SHA256 / Supabase HS256 JWTs (`app_metadata.role === 'admin'`). Gated Instant Pro Demo Activation behind `import.meta.env.DEV` and enforced mandatory HMAC signatures on Razorpay/Stripe webhooks.
2. **Bloat Stripped & Single Unified `brain/`:** Removed `firebase`, `firebase-admin`, `firebase-functions`, duplicate `tsx` from `dependencies` (keeping `@supabase/supabase-js`); deleted unused multi-cloud configs (`Dockerfile`, `.dockerignore`, `railway.json`, `render.yaml`, `cloudbuild.yaml`, `firebase.json`), 18 committed `.png` screenshots, 5 one-off capture/audit scripts, and duplicate `VibeDiet/brain/`. Lazy-loaded `foodCatalogService.ts` in `ManualEntryScreen.tsx`. Preserved `firestore.rules`, `LEGAL.md`, `build-singlefile.ts`, and `sync-netlify-drop.ts` per `AGENTS.md` Rules 5, 9, and 10.
3. **UTC Date, Future-Date Clamp, `deriveTargets()` & Honest AI Errors:** Added `dateKey()` and exact 0-kcal-discrepancy `deriveTargets()` (`4*P + 4*C + 9*F === calorieTarget`) in `atwater.ts`, replaced UTC `toISOString().split('T')[0]` in `dataStore.ts`/`mockFirestore.ts`, clamped navigation at Today, removed `1750` hydration sentinels, wired honest `POST /v1/meals/photo` & `POST /v1/meals/parse` (503/502 on missing/failed Gemini keys), and replaced fake ping latency in `admin.mts` with HTTP 503 when `GEMINI_API_KEY` is missing.

## Active Files (Read/Edit Only These)
- `AGENTS.md`: Strict agent operational rules & safeguards.
- `brain/00-Home.md`, `brain/Architecture.md`, `brain/Active-Context.md`, `brain/Code-Graph.md`: Single unified root Obsidian vault.
- `netlify/functions/admin.mts` & `netlify/functions/v1.mts`: Zero-trust admin auth, honest 503 ping, `/v1/meals/photo`, `/v1/meals/parse`, `/v1/ai/analyze`.
- `src/middleware/auth.ts`, `src/context/AuthContext.tsx`, `src/components/AdminDashboardScreen.tsx`, `src/components/ProfileScreen.tsx`: P0 security fixes & dev-only Pro demo gate.
- `src/shared/physics/atwater.ts`, `src/lib/dataStore.ts`, `src/lib/mockFirestore.ts`, `src/context/DietContext.tsx`, `src/components/DailyDiaryScreen.tsx`, `src/components/redesign/VibeDietDashboard.tsx`, `src/components/ManualEntryScreen.tsx`: `dateKey()`, `deriveTargets()`, future-date clamp, lazy catalog loading.
- `tests/macroReconciliation.test.ts`, `tests/authMiddleware.test.ts`, `tests/adminEndpoints.test.ts`, `e2e/final-regression.spec.ts`: Security + math + E2E verification suites.

## Recent Changes
- **P0 Auth & Billing Hardened:** Removed all magic backdoor tokens, enforced timing-safe `ADMIN_ACCESS_TOKEN` / signed JWT verification, required HMAC signatures on billing webhooks, gated dev-only Pro activation.
- **Repository Decluttered:** Deleted 20+ unused configs/screenshots/scripts, pruned unused Firebase deps, unified `brain/` at repo root, and code-split `foodCatalogService.ts`.
- **Exact Macro & Local Date Physics:** Shipped `deriveTargets()` (`4P + 4C + 9F === kcal`) and `dateKey()` with unit tests and future-date navigation clamp.
