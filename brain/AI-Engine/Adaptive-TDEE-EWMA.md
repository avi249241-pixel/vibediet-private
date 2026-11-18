# ⚖️ Adaptive TDEE & EWMA Engine

#ai-model

Linked: [[00-Home]] | [[Architecture]] | [[Metabolism-Coach]] | [[Today-Dashboard]] | [[DietContext]] | [[Serverless-API]] | [[PostgreSQL-Schema]] | [[Adaptive-Metabolism-Coach]]

## Source Files
- `VibeDiet/src/shared/physics/adaptiveTdee.ts`
- `VibeDiet/src/services/weeklyAutopilot.ts`

## Mathematical Model
1. **Mifflin-St Jeor Baseline BMR:**
   - Male: $10W + 6.25H - 5A + 5$
   - Female: $10W + 6.25H - 5A - 161$
2. **EWMA Weight Smoothing ($\alpha = 0.12$):**
   $$\text{Smoothed}_t = 0.12 \times \text{Weight}_t + 0.88 \times \text{Smoothed}_{t-1}$$
3. **True Expenditure Calibration:** Computes empirical energy balance across the true span of weigh-ins ($d_2 - d_1$ days) using $7{,}700\text{ kcal/kg}$ and reconciles targets for `fat_loss`, `moderate_cut`, `aggressive_cut`, `maintenance`, `lean_mass`, and `lean_gain`.
4. **Hard Physiological Safety Floors:** Never drops targets below **1,200 kcal/day (female)** or **1,500 kcal/day (male)**.
5. **Dynamic Target Flow:** Accepting recommendations in [[Metabolism-Coach]] calls `PUT /v1/biometrics` ([[Serverless-API]]) → updates `vibe_biometrics` ([[PostgreSQL-Schema]]) → immediately recalculates [[Today-Dashboard]] calorie and macro targets via [[DietContext]].
