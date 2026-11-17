# 🧭 VibeDiet System Hub

Welcome to the **VibeDiet 2.0** second brain. This in-repo memory system maps out the application architecture, runtime workflows, and active context so agents never need to perform broad repository scans.

---

## ⚡ Quick Navigation

- 📐 **[[Architecture]]**: Complete architectural blueprint, tech stack, data pipelines, and core source file map (under 120 lines).
- 🎯 **[[Active-Context]]**: Current task focus, active files to read/edit, and recent implementation changes.

---

## 🚀 Core Features

- 📸 **[[Features/AI-Vision-Nutrition-Swarm|AI Vision Nutrition Swarm]]**: Multimodal image logging with 4-stage progressive review (`plate_detected` → `volumetric_depth` → `usda_mapped` → `atwater_verified`) powered by Gemini 2.5 Flash / Pro.
- ⚖️ **[[Features/Adaptive-Metabolism-Coach|Adaptive Metabolism Coach]]**: Daily EWMA weight smoothing, dynamic TDEE recalibration, 14-day plateau detection, and glycogen refeed intelligence.
- 🔬 **[[Features/Evidence-Hierarchy-Atwater|Evidence Hierarchy & Atwater Engine]]**: Strict 4-tier nutritional hierarchy (USDA/IFCT, Barcode Registry, Vision Swarm, Natural Decomposer) and mathematical macro reconciliation ($4P + 4C + 9F \equiv \text{kcal}$).

---

## 🛡️ Operating Directives

Every engineering agent must adhere to the rules in `AGENTS.md`:
1. **Memory First:** Read `[[Architecture]]` and `[[Active-Context]]` before touching code.
2. **Zero Full-Repo Scans:** Only inspect files explicitly designated in `[[Active-Context]]`.
3. **Update Memory Last:** Record changes and active files in `[[Active-Context]]` before concluding tasks.
4. **Keep Notes Clean:** Use standard Markdown with `[[WikiLinks]]` across `brain/`.
