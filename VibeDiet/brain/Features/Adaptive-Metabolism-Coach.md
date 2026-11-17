# ⚖️ Adaptive Metabolism Coach

Linked: [[00-Home]] | [[Architecture]]

## Overview
The Adaptive Metabolism Coach continuously adjusts daily caloric targets based on real-world weight trends and logged energy intake, replacing static formula estimates with an empirical feedback loop.

## Core Physics & Calculations (`src/shared/physics/adaptiveTdee.ts`)
1. **Mifflin-St Jeor Baseline BMR:**
   - Men: $10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} + 5$
   - Women: $10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} - 161$
2. **EWMA Weight Smoothing:** Filters out daily hydration fluctuations using an Exponentially Weighted Moving Average ($\alpha = 0.12$):
   $$\text{trend}_t = \alpha \times \text{weight}_t + (1 - \alpha) \times \text{trend}_{t-1}$$
3. **Adaptive TDEE Recalibration:**
   Calculates actual weekly rate of change against target rate of change. Recalculates intake targets across complete spans ($d_2 - d_1$ days) rather than single partial days.
4. **Safety Floors:** Hard mathematical minimums of 1,200 kcal/day for females and 1,500 kcal/day for males are strictly enforced.
5. **Plateau Detection & Glycogen Refeeds:** Requires $\ge 14$ consecutive days of flat EWMA weight under a verified deficit before suggesting a structured glycogen replenishment day.
