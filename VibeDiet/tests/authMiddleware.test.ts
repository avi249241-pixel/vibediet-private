import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { env } from '../src/config/env.js';

describe('Auth & Zero-Trust Security Middleware', () => {
  const app = createApp();

  it('rejects requests without a Bearer token with 401', async () => {
    const res = await request(app).get('/v1/days/2026-10-25');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_MISSING_BEARER');
  });

  it('rejects invalid Bearer tokens with 401', async () => {
    const res = await request(app)
      .get('/v1/days/2026-10-25')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('blocks non-admin tokens from /v1/admin/overview with 403', async () => {
    const res = await request(app)
      .get('/v1/admin/overview')
      .set('Authorization', 'Bearer guest-non-admin-token');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('rejects mock tokens strictly when NODE_ENV is production', async () => {
    const originalEnv = env.NODE_ENV;
    (env as any).NODE_ENV = 'production';
    try {
      const res = await request(app)
        .get('/v1/days/2026-10-25')
        .set('Authorization', 'Bearer uid:demo-user-uid');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_MOCK_TOKEN_FORBIDDEN');
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  it('enforces payload size cap (rejects payloads >100kb with 413)', async () => {
    // Generate a payload > 100 KB
    const bigString = 'x'.repeat(110 * 1024);
    const res = await request(app)
      .post('/v1/meals/manual')
      .set('Authorization', 'Bearer uid:demo-user-uid')
      .set('Content-Type', 'application/json')
      .send({ date: '2026-10-25', slot: 'lunch', title: bigString, items: [] });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('includes hardened Helmet and CSP security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
