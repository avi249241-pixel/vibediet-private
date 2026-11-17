# 🔬 01 — Competitive Research & Product Specifications

## 1. Competitive Landscape Matrix

| Feature | MyFitnessPal / Cronometer | Cal AI / SnapCalorie | **VibeDiet v2.0** |
| :--- | :--- | :--- | :--- |
| **Logging Friction** | High (manual gram search) | Low (1-click photo) | **Ultra-Low (Photo + Clarifying Qs + Repeat Drawer)** |
| **Calorie Math Integrity** | Unverified crowdsourced entries | Single-number black-box hallucination | **Atwater 4-4-9-7 Reconciliation (±10% tolerance)** |
| **Evidence Transparency** | Opaque checkmark icons | None | **Explicit 4-Tier Badges (T1 USDA, T2 Barcode, T3 AI, T4 User)** |
| **Hidden Cooking Fats** | Ignored unless manually added | Ignored | **Explicit `observable_low` / `moderate` / `unobservable_unknown` bounds** |
| **Metabolic Adaptation** | Static Mifflin-St Jeor only | Static formula | **Rolling 14-day $\alpha = 0.12$ EWMA True TDEE + Plateau Refeed Coach** |
| **Offline Capability** | Requires cloud subscription | Requires cloud server | **100% Offline Standalone `VibeDiet-App.html` + Cloud Sync** |

## 2. Core User Persona Insights
- **Indian & Global Fusion Diets:** Traditional trackers fail on regional dishes (e.g., Paneer Tikka, Dal Makhani, Tadka Ghee, Roti) due to hidden ghee/oil emulsification. VibeDiet's clarifying question drawer specifically probes cooking fat type (`Ghee / Clarified Butter`, `Olive / Mustard Oil`, `Dry Roasted`) and portion density before committing macros.
