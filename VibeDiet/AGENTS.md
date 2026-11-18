# AGENTS.md — Strict Operating Rules for Autonomous Engineering Agents

If you are an AI agent working on VibeDiet, you **must adhere to these operating rules without exception**:

## Core Memory & Workflow Rules
1. **Rule 1 (Memory First):** At the start of EVERY task, read `brain/Architecture.md` and `brain/Active-Context.md` BEFORE touching or searching any code.
2. **Rule 2 (Zero Full-Repo Scans):** Never run broad directory scans or read unrelated files. Only open the exact files listed in `brain/Active-Context.md` or directly required for the requested change.
3. **Rule 3 (Update Memory Last & Sync Graph):** Before finishing ANY task, update `brain/Active-Context.md` with what was changed, which files were modified, and the current status, and run `npm run brain:sync` to regenerate `brain/Code-Graph.md` and verify 0 broken `[[WikiLinks]]` and 0 orphan notes.
4. **Rule 4 (Keep Notes Clean):** Use standard Markdown and Obsidian `[[WikiLinks]]` (e.g., `[[Architecture]]`) when linking between files inside `brain/`.

## Architectural Safeguards & Verification
5. **Rule 5 (Never Loosen Safeguards):** Never remove, weaken, or bypass the **$0.00 aggregate liability shield** (`LEGAL.md`, `LegalModal.tsx`), the non-medical wellness disclaimers, the 1,200/1,500 kcal safety floors, or `firestore.rules`.
6. **Rule 6 (Volume is a Funnel & Scope Discipline):** Deliver concise, deterministic, high-signal code. Keep changes surgical and local. Touch the fewest files possible to achieve the objective.
7. **Rule 7 (No Heavy NPM Bloat):** Rely on native Node 20+ APIs (`fetch`, `node:crypto`, `node:fs`). Do not install bloated third-party HTTP or utility packages.
8. **Rule 8 (Hardware Empathy — 8GB RAM / Intel i3):** Keep the Express + Vite server memory footprint under ~45 MB RSS. Offload heavy parallel swarm tasks to Google Colab (`scripts/colab-swarm-runner.py`) or GitHub Actions (`.github/workflows/test.yml`).
9. **Rule 9 (5-Gate Verification Before Declaration):** Never declare a milestone complete without verifying:
   - Gate 1: `npx tsc --noEmit` (0 errors)
   - Gate 2: `npm test` (all Vitest suites passing)
   - Gate 3: `npm run scan` (0 leaked secrets in `dist/`)
   - Gate 4: `npx playwright test` (all browser E2E journeys passing)
   - Gate 5: `dist/VibeDiet-App.html` built and verified for zero-blank-screen offline execution.
10. **Rule 10 (Automatic Netlify Drop Synchronization):** Whenever you make or complete changes in a conversation turn, ensure `npm run netlify:sync` (or `tsx scripts/sync-netlify-drop.ts`) has run to keep `C:\Users\coder\Desktop\VibeDiet-Netlify-Drop` and `VibeDiet-Netlify-Drop.zip` strictly synchronized with production.
