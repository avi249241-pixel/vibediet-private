import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

describe('System Diagnostic Probes (/health, /ready, /version)', () => {
  const app = createApp();

  it('returns 200 ok on GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns database readiness and RSS memory on GET /ready', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.memoryRssMb).toBe('number');
  });

  it('returns active Gemini 2.5 Flash models on GET /version', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.models.vision).toBe('gemini-2.5-flash');
    expect(res.body.models.fast).toBe('gemini-2.5-flash');
  });
});
