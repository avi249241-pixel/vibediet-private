/**
 * Edge-Native Razorpay Billing & Freemium Gate
 *
 * Implemented using pure Web Fetch API and Web Crypto HMAC-SHA256
 * (zero heavy Node SDKs, ensuring Cloudflare Worker / Netlify Edge CPU stays < 1ms).
 */

import { getSupabaseClient } from '../../services/supabaseClient.js';

export interface BillingEnv {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  SESSION_SECRET?: string;
  [key: string]: string | undefined;
}

/**
 * Authoritative Server-Side Pricing Plans.
 * Never trust client-sent amounts.
 */
export const AUTHORITATIVE_PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'VibeDiet Pro Monthly',
    amountPaise: 14900, // ₹149
    currency: 'INR',
    interval: 'month',
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'VibeDiet Pro Annual',
    amountPaise: 99900, // ₹999
    currency: 'INR',
    interval: 'year',
  },
} as const;

export type PlanKey = keyof typeof AUTHORITATIVE_PLANS;

export const FREE_TIER_DAILY_AI_SCAN_LIMIT = 3;

export interface QuotaCheckResult {
  allowed: boolean;
  tier: 'free' | 'pro';
  scansUsedToday: number;
  dailyLimit: number;
  remainingScans: number;
  message?: string;
}

/**
 * Clean Freemium Quota Gate:
 * Free: 3 AI meal scans/day + full manual/barcode tracking.
 * Pro: Unlimited AI scans + adaptive TDEE coaching.
 */
export function checkAiScanQuota(isPro: boolean, scansUsedToday: number): QuotaCheckResult {
  if (isPro) {
    return {
      allowed: true,
      tier: 'pro',
      scansUsedToday,
      dailyLimit: Infinity,
      remainingScans: Infinity,
    };
  }

  const remaining = Math.max(0, FREE_TIER_DAILY_AI_SCAN_LIMIT - scansUsedToday);
  const allowed = scansUsedToday < FREE_TIER_DAILY_AI_SCAN_LIMIT;

  return {
    allowed,
    tier: 'free',
    scansUsedToday,
    dailyLimit: FREE_TIER_DAILY_AI_SCAN_LIMIT,
    remainingScans: remaining,
    message: allowed
      ? undefined
      : `Daily AI scan quota reached (${FREE_TIER_DAILY_AI_SCAN_LIMIT}/${FREE_TIER_DAILY_AI_SCAN_LIMIT}). Upgrade to Pro for unlimited AI scans and adaptive TDEE coaching!`,
  };
}

/**
 * Pure Web Crypto HMAC-SHA256 hex digest computation.
 */
export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time hex string comparison to eliminate timing-attack vulnerabilities.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();
  if (aNorm.length !== bNorm.length) return false;

  let diff = 0;
  for (let i = 0; i < aNorm.length; i++) {
    diff |= aNorm.charCodeAt(i) ^ bNorm.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies Razorpay payment signature: HMAC-SHA256(order_id + "|" + payment_id, secret)
 */
export async function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const payload = `${orderId}|${paymentId}`;
  const computed = await computeHmacSha256Hex(secret, payload);
  return timingSafeEqualHex(computed, signature);
}

/**
 * Verifies Razorpay webhook signature against raw JSON payload.
 */
export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!rawBody || !signature || !secret) return false;
  const computed = await computeHmacSha256Hex(secret, rawBody);
  return timingSafeEqualHex(computed, signature);
}

/**
 * Updates user tier in Supabase if configured.
 */
export async function updateSupabaseUserTier(userId: string, tier: 'free' | 'pro' = 'pro'): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('vibe_users')
      .update({ tier, updated_at: new Date().toISOString() })
      .eq('id', userId);
    return !error;
  } catch (err) {
    console.warn('[Billing] Supabase tier update warning:', err);
    return false;
  }
}

/**
 * Signs a lightweight Pro status payload using Web Crypto HMAC-SHA256.
 */
export async function signProStatusPayload(
  userId: string,
  secret: string = process.env.SESSION_SECRET || 'vibediet-signed-session-secret-key-38bdf8'
): Promise<string> {
  const payloadObj = {
    uid: userId,
    tier: 'pro',
    isPro: true,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const payloadStr = JSON.stringify(payloadObj);
  const enc = new TextEncoder();
  const b64 = btoa(payloadStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sigHex = await computeHmacSha256Hex(secret, b64);
  return `${b64}.${sigHex}`;
}

/**
 * POST /v1/billing/create-order handler
 */
export async function handleCreateOrder(
  request: Request,
  env: BillingEnv = process.env as BillingEnv
): Promise<Response> {
  const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return new Response(
      JSON.stringify({
        error: 'Razorpay payment gateway keys are not configured',
        status: 503,
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const planKey: PlanKey = body.plan === 'pro_monthly' ? 'pro_monthly' : 'pro_annual';
  const plan = AUTHORITATIVE_PLANS[planKey];
  const userId = body.userId || 'usr_anonymous';

  const basicAuth = btoa(`${keyId}:${keySecret}`);
  const orderPayload = {
    amount: plan.amountPaise,
    currency: plan.currency,
    receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
    notes: {
      userId,
      planKey,
    },
  };

  try {
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      return new Response(
        JSON.stringify({ error: `Razorpay upstream error: ${errText}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data: any = await rzpRes.json();
    return new Response(
      JSON.stringify({
        orderId: data.id,
        amountPaise: plan.amountPaise,
        currency: 'INR',
        keyId,
        planKey,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Network error connecting to Razorpay: ${err?.message || err}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /v1/billing/verify handler
 */
export async function handleVerifyPayment(
  request: Request,
  env: BillingEnv = process.env as BillingEnv
): Promise<Response> {
  const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    return new Response(
      JSON.stringify({ error: 'RAZORPAY_KEY_SECRET is not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response(
      JSON.stringify({ error: 'Missing required Razorpay verification parameters' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const isValid = await verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    keySecret
  );

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid Razorpay payment signature' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Update Supabase user tier to pro
  if (userId) {
    await updateSupabaseUserTier(userId, 'pro');
  }

  const signedProToken = await signProStatusPayload(userId || 'usr_verified_pro');

  return new Response(
    JSON.stringify({
      success: true,
      verified: true,
      tier: 'pro',
      isPro: true,
      signedToken: signedProToken,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * POST /v1/billing/webhook handler
 */
export async function handleWebhook(
  request: Request,
  env: BillingEnv = process.env as BillingEnv
): Promise<Response> {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'RAZORPAY_WEBHOOK_SECRET is not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const signature = request.headers.get('x-razorpay-signature');
  if (!signature) {
    return new Response(
      JSON.stringify({ error: 'Missing X-Razorpay-Signature header' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rawBody = await request.text();
  const isValid = await verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid Razorpay webhook signature' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let eventPayload: any = {};
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid webhook JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = eventPayload.event;
  const payment = eventPayload.payload?.payment?.entity;
  const userId = payment?.notes?.userId || payment?.notes?.uid;

  if (userId && (event === 'payment.captured' || event === 'order.paid')) {
    await updateSupabaseUserTier(userId, 'pro');
  }

  return new Response(
    JSON.stringify({ status: 'ok', received: true, event }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Hono router for Cloudflare Worker edge mounting.
 */
import { Hono } from 'hono';
import type { Bindings } from '../env.js';

export const billingRouter = new Hono<{ Bindings: Bindings }>();

billingRouter.post('/create-order', async (c) => {
  return handleCreateOrder(c.req.raw, (c.env || {}) as unknown as BillingEnv);
});

billingRouter.post('/verify', async (c) => {
  return handleVerifyPayment(c.req.raw, (c.env || {}) as unknown as BillingEnv);
});

billingRouter.post('/webhook', async (c) => {
  return handleWebhook(c.req.raw, (c.env || {}) as unknown as BillingEnv);
});
