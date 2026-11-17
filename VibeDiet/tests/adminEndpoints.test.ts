import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { mockDb } from '../src/lib/mockFirestore.js';
import { keyPoolRouter } from '../src/services/keyPoolRouter.js';

describe('Admin Cockpit Endpoints & Support Ticket Resolution', () => {
  const app = createApp();
  const adminAuth = { Authorization: 'Bearer admin-token' };

  beforeEach(() => {
    mockDb.resetForTests();
  });

  it('returns memory RSS, queue depth, and real key pool telemetry on GET /v1/admin/overview', async () => {
    const res = await request(app).get('/v1/admin/overview').set(adminAuth);
    expect(res.status).toBe(200);
    expect(res.body.memory.rssMb).toBeGreaterThan(0);
    expect(res.body.keyPool.models.vision).toBe('gemini-2.5-flash');
    expect(res.body.swarm.models.activeList).toContain('gemini-2.5-flash');
    expect(res.body.swarm.models.agent3).toBe('gemini-2.5-flash');
    expect(res.body.swarm.models.agent4).toBe('deterministic-physics-engine');
    expect(typeof res.body.swarm.lastExecutionLatencyMs).toBe('number');
    expect(typeof res.body.configuredCount).toBe('number');
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(Array.isArray(res.body.auditLogs)).toBe(true);
  });

  it('adds and removes keys dynamically via POST /v1/admin/keys and DELETE /v1/admin/keys/:id', async () => {
    const initialCount = keyPoolRouter.getPoolSize();

    // 1. Add keys
    const addRes = await request(app)
      .post('/v1/admin/keys')
      .set(adminAuth)
      .send({ keyString: 'AIzaSyTestKeyDynamic123,AQ.TestAuthKey456' });
    expect(addRes.status).toBe(200);
    expect(addRes.body.success).toBe(true);
    expect(addRes.body.addedCount).toBeGreaterThanOrEqual(1);

    // 2. Remove key by mask or ID
    const deleteRes = await request(app)
      .delete('/v1/admin/keys/AIzaSyTestKeyDynamic123')
      .set(adminAuth);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  it('handles live Gemini ping health check on POST /v1/admin/keys/test', async () => {
    const spy = vi.spyOn(keyPoolRouter, 'executeWithRetry').mockResolvedValueOnce('PONG' as any);
    const pingRes = await request(app)
      .post('/v1/admin/keys/test')
      .set(adminAuth);
    expect(pingRes.status).toBe(200);
    expect(pingRes.body.success).toBe(true);
    expect(pingRes.body.reachable).toBe(true);
    expect(pingRes.body.model).toBe('gemini-2.5-flash');
    expect(pingRes.body.telemetry).toBeDefined();
    spy.mockRestore();
  });

  it('creates a consumer support ticket and resolves it via admin endpoint', async () => {
    const created = await request(app)
      .post('/v1/support')
      .set(adminAuth)
      .send({
        category: 'nutrition_fix',
        subject: 'Update Paneer Tikka sodium',
        message: 'Verify USDA FDC sodium baseline.',
      });
    expect(created.status).toBe(201);
    const ticketId = created.body.ticketId;

    const resolved = await request(app)
      .post(`/v1/admin/support/${ticketId}/resolve`)
      .set(adminAuth);
    expect(resolved.status).toBe(200);
    expect(resolved.body.ticket.status).toBe('resolved');
  });
});
