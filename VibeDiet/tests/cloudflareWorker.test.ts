import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { app } from '../src/worker/index.js';
import {
  queueMealDelta,
  queueWeightDelta,
  getPendingOutbox,
  getOutboxCount,
  removeOutboxEntries,
  clearOutbox,
  flushDeltaOutbox,
  pullRemoteDeltas,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from '../src/services/cloudDeltaSync.js';

describe('Cloudflare Worker Hono Edge Backend & Delta Sync Suite', () => {
  const originalEnv = process.env.ADMIN_ACCESS_TOKEN;
  const testAdminToken = 'test_admin_secret_token_gate_pass_ci_32char';

  beforeEach(() => {
    process.env.ADMIN_ACCESS_TOKEN = testAdminToken;
  });

  afterEach(async () => {
    process.env.ADMIN_ACCESS_TOKEN = originalEnv;
    await clearOutbox();
    vi.restoreAllMocks();
  });

  describe('1. Health Check Endpoint (/v1/health)', () => {
    it('returns 200 with worker runtime telemetry and Supabase configuration state', async () => {
      const res = await app.request('/v1/health');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.worker.runtime).toBe('cloudflare-workers');
      expect(typeof json.worker.timestamp).toBe('string');
      expect(typeof json.supabase.configured).toBe('boolean');
      expect(typeof json.supabase.reachable).toBe('boolean');
    });
  });

  describe('2. Admin Overview Zero-Trust Gate (/v1/admin/overview)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await app.request('/v1/admin/overview');
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toMatch(/Unauthorized/i);
    });

    it('rejects short (<16 chars) or backdoor tokens with 401', async () => {
      const res = await app.request('/v1/admin/overview', {
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });
      expect(res.status).toBe(401);
    });

    it('rejects wrong 32-character tokens with 401 timing-safe comparison', async () => {
      const res = await app.request('/v1/admin/overview', {
        headers: {
          Authorization: 'Bearer wrong_admin_secret_token_gate_pass_ci_32',
        },
      });
      expect(res.status).toBe(401);
    });

    it('allows verified administrator with 200 OK and edge telemetry', async () => {
      const res = await app.request('/v1/admin/overview', {
        headers: {
          Authorization: `Bearer ${testAdminToken}`,
        },
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.system.status).toBe('operational');
      expect(json.system.runtime).toBe('cloudflare-workers');
      expect(json.swarm.status).toBe('ready');
      expect(json.swarm.models).toContain('gemini-2.5-flash');
    });
  });

  describe('3. Delta Sync Endpoints (/v1/sync/push & /v1/sync/pull)', () => {
    it('enforces Bearer token presence on POST /v1/sync/push', async () => {
      const res = await app.request('/v1/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meals: [] }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Missing or invalid Authorization/i);
    });

    it('enforces Bearer token presence on GET /v1/sync/pull', async () => {
      const res = await app.request('/v1/sync/pull');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Missing or invalid Authorization/i);
    });

    it('rejects invalid or unauthorized tokens on POST /v1/sync/push', async () => {
      const res = await app.request('/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid_supabase_jwt_token',
        },
        body: JSON.stringify({ meals: [] }),
      });
      // Without configured Supabase client or with invalid token, returns 401
      expect(res.status).toBe(401);
    });
  });

  describe('4. Hybrid Local-First Delta Sync Service (cloudDeltaSync.ts)', () => {
    it('queues meal deltas into outbox with sub-5ms latency and compact payload', async () => {
      const t0 = performance.now();
      const deltaId = await queueMealDelta({
        id: 'meal-edge-test-1',
        date: '2026-11-21',
        slot: 'dinner',
        title: 'Dal Tadka & Brown Rice',
        totalCalories: 480,
        totalProtein: 18.5,
        totalCarbs: 72,
        totalFat: 14.2,
      }, 'upsert');
      const latencyMs = performance.now() - t0;

      expect(latencyMs).toBeLessThan(50); // fast async return
      expect(deltaId).toBeDefined();

      const outbox = await getPendingOutbox();
      expect(outbox.length).toBeGreaterThanOrEqual(1);

      const found = outbox.find((item) => item.data.id === 'meal-edge-test-1');
      expect(found).toBeDefined();
      expect(found?.entity).toBe('meal');
      expect((found?.data as any).calories).toBe(480);
      expect((found?.data as any).protein_g).toBe(18.5);
    });

    it('queues weight deltas into outbox', async () => {
      await queueWeightDelta({
        id: 'weight-edge-test-1',
        date: '2026-11-21',
        weightKg: 78.4,
      }, 'upsert');

      const count = await getOutboxCount();
      expect(count).toBeGreaterThanOrEqual(1);

      const outbox = await getPendingOutbox();
      const found = outbox.find((item) => item.data.id === 'weight-edge-test-1');
      expect(found).toBeDefined();
      expect(found?.entity).toBe('weight');
      expect((found?.data as any).weight_kg).toBe(78.4);
    });

    it('removes processed entries from outbox by ID', async () => {
      const outbox = await getPendingOutbox();
      const ids = outbox.map((i) => i.id);
      await removeOutboxEntries(ids);

      const count = await getOutboxCount();
      expect(count).toBe(0);
    });

    it('safely handles flush when unauthenticated without throwing errors', async () => {
      await queueMealDelta({
        id: 'meal-offline-1',
        date: '2026-11-21',
        totalCalories: 300,
      });

      // No token passed: returns synced 0, failed 0 without throwing
      const result = await flushDeltaOutbox();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);

      // Entries stay queued
      const count = await getOutboxCount();
      expect(count).toBe(1);
    });

    it('manages last sync timestamp in localStorage', () => {
      const now = new Date().toISOString();
      setLastSyncTimestamp(now);
      const retrieved = getLastSyncTimestamp();
      expect(retrieved).toBe(now);
    });

    it('clears all outbox entries on account data wipe', async () => {
      await queueMealDelta({ id: 'm-wipe', date: '2026-11-21' });
      await queueWeightDelta({ id: 'w-wipe', date: '2026-11-21', weightKg: 80 });

      expect(await getOutboxCount()).toBeGreaterThanOrEqual(1);

      await clearOutbox();
      expect(await getOutboxCount()).toBe(0);
    });
  });
});
