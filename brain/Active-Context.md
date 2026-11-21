# VibeDiet — Master Active Context & Architectural State

> **Repository:** `avi249241-pixel/vibediet-private` (`C:\Users\coder\Desktop\VibeDiet (1)`)  
> **App Root:** `C:\Users\coder\Desktop\VibeDiet (1)\VibeDiet`  
> **Obsidian Vault:** `C:\Users\coder\Desktop\VibeDiet (1)\brain`  
> **Active Deployment Target:** Cloudflare Workers + Static Assets (`vibediet-app`) & Supabase

---

## 1. Authoritative Production Architecture (Superseded Decisions Resolved)

Earlier iterations explored Railway/Docker (`e14084b` pruned) and Netlify Drop (`d0efc0f` superseded). The **single authoritative stack** is now:

* **Frontend (`VibeDiet/src/`):** React 19, TypeScript, Vite (`manualChunks`), Tailwind CSS ("Apple Daylight" `#F5F7FA` / `#FFFFFF` + `[data-theme="dark"]`, `#FF6B2C` tangerine energy/CTAs, `#0EA5E9` sky protein/hydration, `tabular-nums`), and PWA offline support (`PwaInstallBanner.tsx`).
* **Edge Backend (`VibeDiet/src/worker/` + `wrangler.toml`):** Cloudflare Workers + Static Assets (`run_worker_first = ["/v1/*"]`) running **Hono** (`src/worker/index.ts`) with sub-routers for `/v1/health`, `/v1/sync`, `/v1/admin`, and `/v1/billing`, plus a 3-day Cron Trigger (`0 3 */3 * *`) to prevent Supabase free-tier pausing.
* **Database & Auth (`Supabase`):** `@supabase/supabase-js` HTTP REST & Google OAuth (`vibe_users`, `vibe_meal_sync`, `vibe_weight_sync`). Legacy `netlify/functions/v1.mts` currently handles remaining `/v1/*` fallback endpoints until fully migrated to native Worker routes.
* **Local-First Delta Sync (`src/services/cloudDeltaSync.ts` + `offlineSyncQueue.ts`):** IndexedDB outbox (`vibediet_delta_sync_db`) with `localStorage` fallback, flushing compact delta payloads to `POST /v1/sync/push` and hydrating via `GET /v1/sync/pull?since=`.
* **Swappable VisionEngine & Physics (`src/vision/` + `src/shared/physics/`):**
  * `CloudStructuredVisionEngine` (`gemini-2.5-flash` $\rightarrow$ `2.5-pro` $\rightarrow$ `2.5-flash-lite`) outputs strictly spatial scale anchors, discrete food components, gram estimates, cooking methods, and oil/ghee sheen levels (**zero calorie/macro guessing**).
  * `nutritionResolver.ts` grounds items against IFCT/USDA catalogs, adds deterministic oil fat (`none: 0g`, `light: 2.5g`, `standard: 5.0g`, `heavy: 10.0g`), and enforces strict Atwater physics ($4P + 4\text{netCarbs} + 9F = \text{kcal}$).
  * `weeklyAutopilot.ts` runs EWMA ($\alpha = 0.12$) weight smoothing and adaptive TDEE calibration.
* **Edge-Native Billing (`src/worker/routes/billing.ts`):** Pure Web Crypto `HMAC-SHA256` + Web Fetch Razorpay checkout (`/create-order`, `/verify`, `/webhook`) with server-authoritative pricing (`pro_monthly`: `₹149`, `pro_annual`: `₹999`) and a `3 scans/day` free-tier quota gate.

---

## 2. Non-Negotiable Codebase & UI Invariants

1. **Navbar DOM Contract (`VibeDietNavbar.tsx` / `Navigation.tsx`):** Keep strictly **5 `<button>` elements** inside the primary `<header>`/`<nav>` bar; secondary controls (theme toggle, ⌘K pill, legal trigger, user avatar) must use `<div role="button">` so E2E navigation assertions pass.
2. **Admin Air-Gap & Auth (`AdminDashboardScreen.tsx`, `src/worker/routes/admin.ts`):** `/admin` and `/#admin` remain lazy-loaded and isolated with zero admin links or system telemetry exposed in consumer views. Admin access requires `ADMIN_ACCESS_TOKEN` ($\ge 16$ chars, constant-time XOR comparison) or a verified Supabase JWT (`app_metadata.role === 'admin'`). Back-navigation preserves `/`.
3. **Demo Pro Gate (`ProfileScreen.tsx`):** Instant Pro Demo Activation stays gated behind `isLocalOrDev` (`import.meta.env.DEV` / localhost).
4. **Date, Hydration & Atwater Invariants:** Always use local `dateKey()` (never UTC `toISOString().split('T')[0]`), enforce future-date clamps, never inject default hydration sentinels (0 ml default), and maintain $4P + 4C + 9F = \text{calorieTarget}$.
5. **E2E Test Data Isolation:** `playwright.config.ts` sets `VIBEDIET_DATA_DIR='.tmp-playwright-data'` so Playwright journeys never pollute local diary storage.
6. **Obsidian Neural Graph (`AGENTS.md`):** Always run `npm run brain:sync` after structural changes and verify `0 broken links` and `0 orphan notes` across [[Architecture]], [[Code-Graph]], [[Serverless-API]], and feature notes.

---

## 3. Completed & Verified State

* **Brain & Graph Automation:** `scripts/sync-brain-graph.ts` indexes **105 modules**, **20 notes**, and **488 wikilinks** (`0` broken, `0` orphans).
* **TypeScript & Unit/Integration Suite:** `npx tsc --noEmit` passes with **0 errors**; Vitest passes **23/23 test suites (163/163 tests)**.
* **Build & Secret Hygiene:** `npm run build` + `npm run scan` verifies **0 leaked secrets** across **173 files** in `dist/`. Main `index-*.js` chunk reduced to **316.28 kB** (well under `500 kB` threshold) via isolated `vendor-food-catalog` chunk. Standalone offline `dist/VibeDiet-App.html` single-file bundle verified.
* **Full-Stack 6-Fix Audit Implemented & Verified:**
  1. *Billing RLS & Auth Hardening (`src/worker/routes/billing.ts`):* Switched tier upgrade to `getSupabaseAdmin(env)` bypassing RLS; verifies Bearer JWT when present; requires `env.SESSION_SECRET` outside tests.
  2. *Atomic Sync Error Status (`src/worker/routes/sync.ts`):* Returns HTTP `502` on Supabase upsert failures so client outbox retains failed delta mutations for retry.
  3. *Worker Cron, CORS & Admin Keys (`src/worker/index.ts`, `src/worker/routes/admin.ts`):* Pings `${supabaseUrl}/rest/v1/vibe_users?select=id&limit=1` in `scheduled()` for authentic DB activity; restricted `cors()` origins; sanitized 500 error catch block; dynamic Gemini key telemetry in `/v1/admin/overview`.
  4. *Outbox Concurrency Mutex (`src/services/cloudDeltaSync.ts`):* Added `flushInFlight` promise lock around `flushDeltaOutbox()` to coalesce concurrent sync triggers and prevent duplicate push requests.
  5. *Bundle Optimization & Node Built-in Leak Prevention (`vite.config.ts`, `src/config/env.ts`, `src/vision/`):* Isolated `vendor-food-catalog` chunk in Vite Rollup split; unified `computeResolvedMacros()` across resolver and index; dynamically resolved `node:fs`/`node:path` via `process.getBuiltinModule` eliminating all Vite browser externalization warnings.
  6. *Repo & CI Hygiene:* Pruned dead legacy host files (`.netlify`, `netlify.toml`, `vercel.json`, `api/index.ts`, `scripts/sync-netlify-drop.*`, duplicate `VibeDiet/.github/`), cleaned dead Netlify sync npm scripts.

---

## 4. Environment & Cloudflare Production Launch
1. **Upgrade Node.js to v22.12.0+ LTS:** Current local machine runs Node `v20.18.0`, while `wrangler@4.166.0` requires Node `>= 22.12.0`.
2. **Authenticate & Push Secrets:** Set `CLOUDFLARE_API_TOKEN` (or run `npx wrangler login`), upload `.env` secrets via `npx wrangler secret bulk .env`, and deploy via `npm run cf:deploy`.
3. **Post-Deploy Verification:** Whitelist the live `https://vibediet-app.<subdomain>.workers.dev` URL in **Supabase Dashboard → Authentication → URL Configuration**, then verify Google OAuth login, AI meal scan persistence, offline sync flush, `/admin` auth gate, and Razorpay Test UPI checkout.
