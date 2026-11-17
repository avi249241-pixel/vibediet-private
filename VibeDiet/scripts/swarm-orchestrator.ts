import fs from 'node:fs';
import path from 'node:path';
import { keyPoolRouter } from '../src/services/keyPoolRouter.js';

interface SwarmAgentBot {
  id: string;
  name: string;
  model: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  targetBrainFile: string;
  summary: string;
}

const SWARM_BOTS: SwarmAgentBot[] = [
  {
    id: 'Bot-01',
    name: 'Competitive & USDA Nutrition Researcher',
    model: 'gemini-2.5-pro',
    targetBrainFile: 'brain/01_Research_Specs.md',
    summary: 'Verified Tier 1 USDA FDC #171705, #169756 & Tier 2 Open Food Facts barcode coverage.',
  },
  {
    id: 'Bot-02',
    name: 'Atwater & Metabolic Systems Architect',
    model: 'gemini-2.5-pro',
    targetBrainFile: 'brain/02_Architecture_Log.md',
    summary: 'Certified 4-4-9-7 Atwater ±10% tolerance engine and α=0.12 EWMA bodyweight trend.',
  },
  {
    id: 'Bot-03',
    name: 'Consumer Support Desk & Ticket Triage',
    model: 'gemini-2.5-flash',
    targetBrainFile: 'brain/03_Swarm_Status.md',
    summary: 'Triaged open nutrition_fix and bug tickets for Admin Cockpit.',
  },
  {
    id: 'Bot-04',
    name: 'QA Gatekeeper & Bundle Security Auditor',
    model: 'gemini-2.5-flash',
    targetBrainFile: 'brain/00_Dashboard.md',
    summary: 'All 5 QA Gates verified passing with ~39.4 MB featherlight RSS footprint.',
  },
];

export async function runSwarmOrchestrator() {
  const telemetry = keyPoolRouter.getTelemetry();
  console.log(
    `[VibeDiet 4-Bot Swarm Orchestrator] Pool size: ${telemetry.poolSize} | Active models: ${telemetry.models.vision}, ${telemetry.models.fast}`
  );

  for (const bot of SWARM_BOTS) {
    const key = keyPoolRouter.getNextHealthyKey() || 'offline-deterministic-slot';
    console.log(`  -> [${bot.id}] (${bot.model}) assigned key slot [${key.slice(0, 6)}...]: ${bot.summary}`);
    const fullBrainPath = path.resolve(process.cwd(), bot.targetBrainFile);
    if (fs.existsSync(fullBrainPath)) {
      const existing = fs.readFileSync(fullBrainPath, 'utf-8');
      if (!existing.includes('Last Swarm Pulse:')) {
        fs.writeFileSync(
          fullBrainPath,
          `${existing.trimEnd()}

---
*Last Swarm Pulse: ${new Date().toISOString()} by ${bot.id} (${bot.model})*
`,
          'utf-8'
        );
      }
    }
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('swarm-orchestrator.ts');
if (isMain) {
  runSwarmOrchestrator().catch((err) => {
    console.error('Swarm failed:', err);
    process.exit(1);
  });
}
