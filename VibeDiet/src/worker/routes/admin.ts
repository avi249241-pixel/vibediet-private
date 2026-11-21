import { Hono } from 'hono';
import type { Bindings } from '../env.js';

export const adminRouter = new Hono<{ Bindings: Bindings }>();

function timingSafeStringEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

function countConfiguredGeminiKeys(env?: Bindings): number {
  const poolRaw =
    (typeof env?.GEMINI_API_KEYS === 'string' ? env.GEMINI_API_KEYS : '') ||
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEYS || '' : '');
  const singleRaw =
    (typeof env?.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY : '') ||
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || '' : '');

  const keys = new Set<string>();
  for (const part of poolRaw.split(/[\s,;]+/)) {
    const trimmed = part.trim();
    if (trimmed && !trimmed.startsWith('your_')) keys.add(trimmed);
  }
  const singleTrimmed = singleRaw.trim();
  if (singleTrimmed && !singleTrimmed.startsWith('your_')) {
    keys.add(singleTrimmed);
  }
  return keys.size;
}

adminRouter.get('/overview', async (c) => {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const expectedToken = (
    c.env?.ADMIN_ACCESS_TOKEN ||
    (typeof process !== 'undefined' ? process.env.ADMIN_ACCESS_TOKEN : undefined) ||
    ''
  ).trim();

  if (!token || token.length < 16 || expectedToken.length < 16 || !timingSafeStringEqual(token, expectedToken)) {
    return c.json({ error: 'Unauthorized: Verified administrator credentials required' }, 401);
  }

  const memUsage =
    typeof process !== 'undefined' && process.memoryUsage
      ? Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2))
      : 39.4;

  const configuredKeys = countConfiguredGeminiKeys(c.env);
  const timestamp = new Date().toISOString();

  return c.json({
    system: {
      status: 'operational',
      timestamp,
      rssMb: memUsage,
      memoryRssMb: memUsage,
      activeKeys: configuredKeys,
      totalKeys: configuredKeys,
      runtime: 'cloudflare-workers',
    },
    keys: {
      active: configuredKeys,
      total: configuredKeys,
      status: configuredKeys > 0 ? 'healthy' : 'unconfigured',
    },
    keyPool: {
      configuredCount: configuredKeys,
      activeCount: configuredKeys,
      cooldownCount: 0,
      revokedCount: 0,
      poolSize: configuredKeys,
      slots: [],
    },
    keySlots: [],
    swarm: {
      status: 'ready',
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    },
  }, 200);
});