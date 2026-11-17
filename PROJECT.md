# Project: VibeDiet UI Overhaul & Consumer/Admin Separation

## Architecture
- **Client App**: React 18 SPA with Tailwind CSS v4, Lucide icons, and responsive desktop/mobile layout.
- **Backend**: Express 4 server (`server.ts`) hosting REST API endpoints (`/v1/admin/*`, `/v1/vision/*`, `/v1/usda/*`, `/health`) and serving SPA static distribution bundles (`dist/index.html`, `dist/assets/*`).
- **Routing**: Client-side hash and pathname detection (`/admin`, `/#admin`, `/?admin=1`) synchronizing `cockpitMode` in `src/App.tsx`. Express server-side wildcard routing serving `dist/index.html` for both `/` and `/admin` routes.
- **Separation Boundary**:
  - `http://127.0.0.1:3000/`: Pure consumer nutrition app with 5 tabs (`Today`, `AI Meal Scan`, `Food Search`, `Metabolism`, `Profile`). Zero backend telemetry, zero key pool pills, zero admin tabs in header.
  - `http://127.0.0.1:3000/admin` (or `/#admin`): Dedicated VibeDiet Backend Engine & Key Pool Console with dedicated top bar and `← Open Consumer App (127.0.0.1:3000)` back link.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Purge Admin Telemetry from Consumer UI | Remove `8 Keys Active · 39.4 MB RAM` pill, `Single-User High-Security Macro & Vision AI` tagline, `Legal` link, and `System & Keys` tab from `Navigation.tsx` | M1 | ORIGINAL_REQUEST §1 |
| 2 | Pure 5-Tab Consumer Navigation | Consumer navigation bar displays strictly 5 tabs: Today, AI Meal Scan, Food Search, Metabolism, Profile | M1 | ORIGINAL_REQUEST §1 |
| 3 | Dedicated Backend Admin Route | Express `server.ts` routes `GET /admin` to `dist/index.html` and mounts static assets; `src/App.tsx` routes `/admin` and `#admin` exclusively to `AdminDashboardScreen` | M1 | ORIGINAL_REQUEST §1 |
| 4 | Isolated Admin Console UI | `AdminDashboardScreen.tsx` styled as dedicated console with top bar, URL badge, and `← Open Consumer App (127.0.0.1:3000)` | M1 | ORIGINAL_REQUEST §1 |
| 5 | E2E Test Compatibility & Dev Trigger | Update Playwright test #5 in `e2e/vibediet.spec.ts` for `#admin`; provide subtle footer in `src/App.tsx` for legal modal & onboarding test IDs | M1 | ORIGINAL_REQUEST §1 |
| 6 | Ambient Mesh Background | Add 3-point radial gradient mesh glows in `src/index.css` and unblock opaque backgrounds in `index.html` & `src/App.tsx` | M2 | ORIGINAL_REQUEST §2 |
| 7 | Glowing Electric Calories Ring | Emerald-to-Cyan SVG linearGradient (`#10B981` → `#06B6D4`) with drop-shadow glow and richly tinted track ring | M2 | ORIGINAL_REQUEST §2 |
| 8 | Vibrant Macro Palette Mini-Cards | Protein (`from-violet-500 to-fuchsia-500`), Carbs (`from-amber-400 to-rose-500`), Fat (`from-rose-500 to-pink-500`) with glowing icon badges | M2 | ORIGINAL_REQUEST §2 |
| 9 | Electric Hydration Card | Sky-to-Blue gradient pill (`from-sky-400 to-blue-600`) with animated water fill and `+250ml` quick-add button | M2 | ORIGINAL_REQUEST §2 |
| 10 | Structured 4-Slot Meal Cards | Replace flat empty box with 4 interactive cards (`Breakfast 🌅`, `Lunch ☀️`, `Dinner 🌙`, `Snacks 🍎`) with suggested calories and `+ Log Meal` / `📸 Snap Photo` buttons | M2 | ORIGINAL_REQUEST §2 |
| 11 | Dock Overlap Elimination | Add `pb-40` container spacing to `<main>` in `App.tsx` and convert `OmnibarDock.tsx` into a clean sticky footer (`sticky bottom-6 mb-8`) | M2 | ORIGINAL_REQUEST §3 |
| 12 | 5 Quality Verification Gates | Run `typecheck`, `test`, `build`, `scan`, and `playwright` with 100% pass rate using `$env:PATH = "C:\Users\coder\AppData\Local\Programs\nodejs;$env:PATH"` | M3 | ORIGINAL_REQUEST §4 |
| 13 | Production Screenshots Capture | Capture clean 1280x800 screenshots of Consumer UI (`http://127.0.0.1:3000/`) and Admin Console (`http://127.0.0.1:3000/#admin`) | M3 | ORIGINAL_REQUEST §4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Consumer vs Admin Separation & Dedicated `/admin` Route | `server.ts`, `src/App.tsx`, `src/components/Navigation.tsx`, `src/components/AdminDashboardScreen.tsx`, `e2e/vibediet.spec.ts` | Survey | BLOCKED: Forensic Audit Integrity Violation (opacity-0 masking in Navigation.tsx) |
| M2 | Vibrant Glassmorphism UI, 4-Slot Meal Cards & Dock Overlap Fix | `src/index.css`, `index.html`, `src/App.tsx`, `src/components/DailyDiaryScreen.tsx`, `src/components/OmnibarDock.tsx`, `src/components/PhotoLogScreen.tsx`, `src/components/ManualEntryScreen.tsx` | M1 | PLANNED |
| M3 | Full 5-Gate Verification & Screenshots | All 5 gates (`typecheck`, `test`, `build`, `scan`, `playwright`), automated screenshot generation and validation | M2 | PLANNED |

## Interface Contracts
### `server.ts` ↔ Client SPA
- `GET /admin`, `GET /admin/*`, `GET /admin.html`: Sends `dist/index.html` (falls back to `dist/VibeDiet-App.html`).
- `app.use('/admin', express.static(distPath))`: Resolves relative `./assets/...` bundles under `/admin` without 404s.
- `GET /health`: JSON `{ status: 'ok', uptime, timestamp }`.

### `src/App.tsx` ↔ Route State
- `checkIsAdminRoute()`: returns `true` if `pathname === '/admin'`, `hash === '#admin'`, or `search.includes('admin=1')`.
- When `isAdminRoute === true`: renders `<AdminDashboardScreen />` only.
- When `isAdminRoute === false`: renders `<Navigation />`, consumer tab view, `<OmnibarDock />`, and subtle consumer `<footer />`.

### `DailyDiaryScreen.tsx` ↔ `App.tsx` ↔ Meal Slot Logging
- `onOpenPhotoScanner(slot?: MealSlot)`: opens photo scanner with pre-selected slot.
- `onOpenManualEntry(slot?: MealSlot)`: opens manual entry with pre-selected slot.

## Code Layout
- `server.ts`: Express backend, API routing, static bundle serving.
- `src/App.tsx`: Top-level app shell, route coordinator, layout container.
- `src/components/Navigation.tsx`: Consumer top navigation (5 tabs only).
- `src/components/AdminDashboardScreen.tsx`: Admin console with top navigation bar.
- `src/components/DailyDiaryScreen.tsx`: Daily dashboard, calories ring, macro cards, hydration card, 4 meal slot cards.
- `src/components/OmnibarDock.tsx`: Sticky quick-action bar.
- `src/index.css`: Tailwind v4 styles, ambient radial gradient mesh glows, glassmorphism utilities.
- `e2e/vibediet.spec.ts`: Playwright end-to-end test suite.
