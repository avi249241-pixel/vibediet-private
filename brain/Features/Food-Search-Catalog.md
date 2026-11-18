# 🔍 Food Search & Barcode Catalog

#feature #ui

Linked: [[00-Home]] | [[Architecture]] | [[DietContext]] | [[Atwater-Verifier]] | [[Today-Dashboard]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/components/ManualEntryScreen.tsx`
- `VibeDiet/src/components/BarcodeScannerModal.tsx`
- `VibeDiet/src/services/foodCatalogService.ts`
- `VibeDiet/src/services/apiConnectors.ts`

## Pipeline Flow
1. **Tier 1 USDA / IFCT Search:** `ManualEntryScreen.tsx` filters local verified staples instantaneously and debounces live queries to `GET /v1/foods/search?q=...`.
2. **Tier 2 Open Food Facts Barcode:** `BarcodeScannerModal.tsx` scans EAN/UPC barcodes via live camera or manual entry and resolves via `GET /v1/foods/barcode/:code`.
3. **Live Atwater Verification:** Custom food entries and catalog items pass through [[Atwater-Verifier]] (`reconcileAtwaterMacros` & `normalizeFoodItem`) before saving to [[DietContext]].

## State Hooks, API Endpoints & Database Tables
- **Context:** `useDiet()` ([[DietContext]]) via `addManualMeal()`, `useAuth()` for tenant `token`.
- **API ([[Serverless-API]]):** `GET /v1/foods/search`, `GET /v1/foods/barcode/:code`, `POST /v1/meals/manual`.
- **Database ([[PostgreSQL-Schema]]):** `vibe_meals`, `vibe_day_summaries`.
