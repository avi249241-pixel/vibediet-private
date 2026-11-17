import { sweepStalledDrafts } from '../src/services/draftProcessor.js';

const result = sweepStalledDrafts(10 * 60 * 1000);
console.log(
  `[VibeDiet Cold-Instance Sweeper] Scanned: ${result.scanned} | Recovered: ${result.recovered} | Expired: ${result.expired}`
);
