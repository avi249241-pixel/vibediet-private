# 🧬 Metabolism Coach & Weekly Autopilot

#feature #ui

Linked: [[00-Home]] | [[Architecture]] | [[DietContext]] | [[Adaptive-TDEE-EWMA]] | [[Today-Dashboard]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/components/MetabolismCoachScreen.tsx`
- `VibeDiet/src/components/WeeklyCheckInModal.tsx`
- `VibeDiet/src/services/weeklyAutopilot.ts`
- `VibeDiet/src/shared/physics/adaptiveTdee.ts`

## End-to-End Pipeline
1. **Scale Weight Logging:** Users log daily scale weights (`getLocalDateString()`) → `logScaleWeight()` computes EWMA ($\alpha = 0.12$) via [[Adaptive-TDEE-EWMA]] and persists via `POST /v1/weights`.
2. **Weekly Check-In Modal:** Portal-mounted (`z-[200]`) modal calculates empirical TDEE across true weigh-in intervals, detects 14-day plateaus, enforces 1,200/1,500 kcal floors, and closes on 1 click or 1 Escape.
3. **Target Propagation:** Accepting targets calls `updateBiometrics()` → `PUT /v1/biometrics` → updates `vibe_biometrics` → immediately refreshes [[Today-Dashboard]] calorie & macro rings via [[DietContext]].

## State Hooks, API Endpoints & Database Tables
- **Context:** `useDiet()` ([[DietContext]]) for `biometrics`, `weightLogs`, `logScaleWeight`, `updateBiometrics`.
- **API ([[Serverless-API]]):** `GET /v1/weights`, `POST /v1/weights`, `GET /v1/biometrics`, `PUT /v1/biometrics`.
- **Database ([[PostgreSQL-Schema]]):** `vibe_weights`, `vibe_biometrics`.
