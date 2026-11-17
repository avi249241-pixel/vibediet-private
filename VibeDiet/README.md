# 🥗 VibeDiet — AI-Native Nutrition & Metabolic Intelligence Platform

**Version:** 2.0.0 (`phase-production-ready`)  
**Architecture:** React 19 + TypeScript 5.8 + Tailwind CSS v4 + Express v1 REST API + Firestore / MockFirestore + 50-Key Gemini 3.1 Pro / 3.8 Flash Swarm

---

## ✨ Key Capabilities

1. **Instant Photo Recognition & Clarifying Questions:** Downscales camera photos client-side to 1024px JPEG (<250 KB), decomposes ingredients via `gemini-3.1-pro-preview` (with deterministic offline Indian-fusion demo fallback), and resolves hidden cooking oils and portion scales interactively.
2. **4-Tier Nutrition Evidence Badges:**
   - 🟢 **Tier 1 (`T1 Verified`):** USDA FoodData Central Foundation Foods
   - 🔵 **Tier 2 (`T2 Barcode`):** Open Food Facts Packaged Barcode
   - 🟣 **Tier 3 (`T3 AI Vision`):** Gemini 3.1 Pro Multi-Modal Decomposition
   - ⚪ **Tier 4 (`T4 User Estimate`):** Manual / Restaurant Estimate
3. **Atwater General Factor Reconciliation ($4\text{-}4\text{-}9\text{-}7$):**
   - Automatically verifies $\text{Energy} = 4P + 4(\text{Carbs} - \text{Fiber}) + 9F + 7\text{Alc}$ and flags $>10\%$ label discrepancies + `⚠️ Unobservable Fats`.
4. **Adaptive Metabolism Coach ($\alpha = 0.12$ EWMA):**
   - Mifflin-St Jeor BMR calculation, 14-day exponentially smoothed bodyweight trend, rolling True TDEE expenditure calibration, plateau refeed detection, and 1,200 / 1,500 kcal safety floors.
5. **Customer App ↔ ⚡ Admin Cockpit Switch:**
   - Instant toggle in the header to inspect Node.js RAM/Heap telemetry, draft queue depth, 50-key Gemini pool cooldown states, cold-instance draft sweeper triggers, and customer support tickets.
6. **Zero-Blank-Screen Standalone Bundle (`dist/VibeDiet-App.html`):**
   - Double-click `dist/VibeDiet-App.html` in any browser to run the complete application 100% offline without a server.

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional for offline/mock mode)
cp .env.example .env

# 3. Start Express v1 API + Vite Dev Server (http://localhost:3000)
npm run dev

# 4. Run 5-Gate Quality Verification
npm run typecheck
npm test
npm run build
npm run scan
```
