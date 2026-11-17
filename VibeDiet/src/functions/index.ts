import { processDraft, sweepStalledDrafts } from '../services/draftProcessor.js';

/**
 * 2nd-Gen Cloud Function trigger skeleton for asynchronous draft recognition.
 */
export async function processDraftTrigger(event: { uid: string; draftId: string }) {
  return await processDraft(event.uid, event.draftId);
}

/**
 * Scheduled Cloud Function trigger for sweeping cold-instance stalled drafts.
 */
export async function draftSweeperTrigger() {
  return sweepStalledDrafts(10 * 60 * 1000);
}
