# ⚡ Active Context

## Current Focus
Stabilization, verification, and hardening of VibeDiet 2.0:
1. Multi-tenant browser-scoped UID isolation (`usr_<uuid>`) and elimination of shared global `demo-user-uid`.
2. Netlify serverless parity in `netlify/functions/v1.mts` and `admin.mts` (hardened auth gate, purged backdoor tokens and key leaks).
3. Zero-calorie macro target reconciliation ($4P + 4C + 9F = \text{targetCalories}$) and Atwater confidence bounds.
4. Offline mutation queueing (`LOG_MEAL`, `LOG_WATER`) with ServiceWorker precaching.
5. In-repo Obsidian second brain system (`brain/00-Home.md`, `brain/Architecture.md`, `brain/Active-Context.md`, `brain/Features/*`).

## Active Files (Read/Edit Only These)
- `AGENTS.md`: Strict agent operational rules and memory protocols.
- `brain/00-Home.md`: Second brain home dashboard.
- `brain/Architecture.md`: Core system architecture and essential file map.
- `brain/Active-Context.md`: Current runtime focus and task status.
- `brain/Features/AI-Vision-Nutrition-Swarm.md`: Multimodal vision logging documentation.
- `brain/Features/Adaptive-Metabolism-Coach.md`: Adaptive TDEE and EWMA physics documentation.
- `brain/Features/Evidence-Hierarchy-Atwater.md`: Nutritional evidence tiers and Atwater physics documentation.
- `.gitignore`: Git exclusions file with `brain/.obsidian/` rule.
- `netlify/functions/v1.mts`: Serverless consumer API router.
- `netlify/functions/admin.mts`: Serverless admin API router.
- `src/context/AuthContext.tsx`: Isolated UID generation and authentication state.
- `src/context/DietContext.tsx`: Nutrition state, date management, and offline mutation queue.
- `src/shared/physics/atwater.ts`: 4-9-4 Atwater calculations and `getLocalDateString`.
- `src/shared/physics/adaptiveTdee.ts`: Adaptive TDEE delta calculation and Mifflin-St Jeor BMR.

## Recent Changes
- **Memory System Setup:** Created Obsidian-compatible in-repo memory in `brain/` (`[[00-Home]]`, `[[Architecture]]`, `[[Active-Context]]`, `[[Features/AI-Vision-Nutrition-Swarm]]`, `[[Features/Adaptive-Metabolism-Coach]]`, `[[Features/Evidence-Hierarchy-Atwater]]`).
- **AGENTS.md Modernization:** Embedded Memory-First and Zero-Full-Repo-Scan rules into project root and inner directory.
- **Git Ignore Protection:** Appended `brain/.obsidian/` to `.gitignore`.
- **Macro Math Reconciliation:** Reconciled default macro targets ($168 \times 4 + 247 \times 4 + 65 \times 9 = 2245$ kcal) eliminating the 108 kcal gap; supported `lean_mass` goal mode without `NaN`.
- **Calendar Timezone Hardening:** Introduced `getLocalDateString()` (`en-CA` format) across diary, dashboard date picker, and scale logging to prevent UTC midnight date flips.
- **Natural Language Meal Decomposer:** Added deterministic parser (`naturalLanguageMealParser.ts`) to decompose natural text meals and context notes into verified nutritional items without hardcoded thali fallbacks.
- **Identity Isolation:** Generated persistent browser-scoped UIDs (`usr_<uuid>`) in `AuthContext.tsx`, purged personal email `avi249241@gmail.com`, and removed magic backdoor tokens from admin authentication.
