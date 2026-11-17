import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import {
  createCheckoutSession,
  verifyRazorpaySignature,
  verifyStripeSignature,
  PRICING_PLANS,
} from '../src/services/billingService.js';

describe('Monetization & Commercial Billing Shield', () => {
  const app = createApp();
  const auth = { Authorization: 'Bearer uid:paying-user-1' };

  it('provides public pricing tiers for Monthly and Annual Pro', async () => {
    const res = await request(app).get('/v1/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans.monthly.inr).toBe(299);
    expect(res.body.plans.annual.inr).toBe(1999);
  });

  it('generates a Razorpay UPI checkout session for authenticated users', async () => {
    const res = await request(app)
      .post('/v1/billing/checkout')
      .set(auth)
      .send({ plan: 'annual', gateway: 'razorpay' });

    expect(res.status).toBe(200);
    expect(res.body.session.gateway).toBe('Razorpay UPI');
    expect(res.body.session.amount).toBe(199900); // in paise
    expect(res.body.session.currency).toBe('INR');
  });

  it('generates a Stripe checkout session for global users', async () => {
    const res = await request(app)
      .post('/v1/billing/checkout')
      .set(auth)
      .send({ plan: 'monthly', gateway: 'stripe' });

    expect(res.status).toBe(200);
    expect(res.body.session.gateway).toBe('Stripe Global');
    expect(res.body.session.amount).toBe(499); // cents
    expect(res.body.session.currency).toBe('USD');
  });

  it('verifies HMAC SHA-256 signatures for Razorpay webhooks', () => {
    const payload = JSON.stringify({ event: 'payment.captured' });
    const secret = 'test_webhook_secret_key_123';

    const crypto = require('node:crypto');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = verifyRazorpaySignature(payload, signature, secret);
    expect(isValid).toBe(true);

    const isInvalid = verifyRazorpaySignature(payload, 'tampered_signature', secret);
    expect(isInvalid).toBe(false);
  });
});
