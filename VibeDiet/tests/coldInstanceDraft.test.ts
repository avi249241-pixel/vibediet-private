import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '../src/lib/mockFirestore.js';
import { sweepStalledDrafts } from '../src/services/draftProcessor.js';

describe('Cold-Instance Stalled Draft Sweeper Cron', () => {
  beforeEach(() => {
    mockDb.resetForTests();
  });

  it('recovers stalled queued drafts older than threshold into ready_for_review', () => {
    const bucket = mockDb.getUserBucket('stalled-user');
    const tenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    bucket.drafts.set('draft-stalled-1', {
      id: 'draft-stalled-1',
      uid: 'stalled-user',
      date: '2026-10-25',
      slot: 'dinner',
      status: 'queued',
      createdAt: tenMinutesAgo,
      updatedAt: tenMinutesAgo,
      recognizedItems: [],
      questions: [],
      isDemoMode: true,
    });

    const report = sweepStalledDrafts(5 * 60 * 1000);
    expect(report.recovered).toBe(1);
    expect(bucket.drafts.get('draft-stalled-1')?.status).toBe('ready_for_review');
  });
});
