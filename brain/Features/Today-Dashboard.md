# ✨ Today Dashboard

#feature #ui

Linked: [[00-Home]] | [[Architecture]] | [[DietContext]] | [[Atwater-Verifier]] | [[Adaptive-TDEE-EWMA]] | [[AI-Meal-Scan]] | [[Food-Search-Catalog]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/components/DailyDiaryScreen.tsx`
- `VibeDiet/src/components/redesign/VibeDietDashboard.tsx`
- `VibeDiet/src/components/redesign/VibeDietNavbar.tsx`
- `VibeDiet/src/components/OmnibarDock.tsx`
- `VibeDiet/src/services/macroMealSolver.tsx`

## State Hooks & Wiring
- **Context:** `useDiet()` ([[DietContext]]) for `selectedDate`, `currentDay`, `biometrics`, `repeatMeals`, `addWaterMl`, `deleteMeal`, `clearDayMeals`, `copyRepeatMealToToday`.
- **Visual System:** Spatial frosted-glass bento cards (`backdrop-blur-2xl`), luminous 18px gradient Hero Calorie Ring (`#FB923C → #38BDF8`), per-date Hydration card (strictly defaults to `0 / 2,500 ml` on unlogged past dates), Smart Macro Solver drawer, and dark-glass floating pill dock.

## Connected API Endpoints & Database Tables
- **API ([[Serverless-API]]):** `GET /v1/days/:date`, `POST /v1/days/:date/water`, `POST /v1/meals/manual`, `DELETE /v1/meals/:id`, `GET /v1/repeat-meals`.
- **Database ([[PostgreSQL-Schema]]):** `vibe_meals`, `vibe_days`, `vibe_day_summaries`, `vibe_repeat_meals`, `vibe_biometrics`.
