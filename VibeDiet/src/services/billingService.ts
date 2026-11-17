import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { dataStore } from '../lib/dataStore.js';

export interface SubscriptionTransaction {
  id: string;
  uid: string;
  customerEmail?: string;
  gateway: 'Razorpay UPI' | 'Stripe Global';
  plan: 'Monthly Pro' | 'Annual Pro';
  amount: number;
  currency: 'INR' | 'USD';
  status: 'captured' | 'refunded' | 'pending';
  createdAt: string;
}

export const PRICING_PLANS = {
  monthly: { inr: 299, usd: 4.99, label: 'Monthly Pro' as const },
  annual: { inr: 1999, usd: 24.0, label: 'Annual Pro' as const },
};

/**
 * Validates Razorpay webhook HMAC SHA-256 signature
 */
export function verifyRazorpaySignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string = env.RAZORPAY_WEBHOOK_SECRET || ''
): boolean {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  const digestBuf = Buffer.from(digest);
  const sigBuf = Buffer.from(signature);
  if (digestBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

/**
 * Validates Stripe webhook HMAC SHA-256 signature (t=...,v1=...)
 */
export function verifyStripeSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string = env.STRIPE_WEBHOOK_SECRET || ''
): boolean {
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));
  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const signature = signaturePart.slice(3);

  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload);
  const digest = hmac.digest('hex');

  const digestBuf = Buffer.from(digest);
  const sigBuf = Buffer.from(signature);
  if (digestBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

/**
 * Creates checkout session payload for monetization
 */
export function createCheckoutSession(
  uid: string,
  planKey: 'monthly' | 'annual',
  gateway: 'razorpay' | 'stripe'
) {
  const plan = PRICING_PLANS[planKey];
  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (gateway === 'razorpay') {
    return {
      gateway: 'Razorpay UPI',
      orderId,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_VibeDiet99210A',
      amount: plan.inr * 100, // paise
      currency: 'INR',
      planName: plan.label,
      notes: { uid, planKey },
    };
  }

  return {
    gateway: 'Stripe Global',
    sessionId: `cs_test_${Date.now()}`,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51VibeDietGlobal881',
    amount: plan.usd * 100, // cents
    currency: 'USD',
    planName: plan.label,
    metadata: { uid, planKey },
  };
}

/**
 * Activates Pro subscription on user record
 */
export async function activateUserSubscription(
  uid: string,
  transaction: SubscriptionTransaction
): Promise<void> {
  const db = (await import('../lib/dataStore.js')).getFirestoreDb();
  if (db) {
    try {
      await db.collection('users').doc(uid).set(
        {
          isPro: true,
          subscription: {
            status: 'active',
            plan: transaction.plan,
            gateway: transaction.gateway,
            activatedAt: new Date().toISOString(),
          },
        },
        { merge: true }
      );
      await db.collection('transactions').doc(transaction.id).set(transaction);
      console.log(`[Billing] Activated Pro subscription for user ${uid}`);
    } catch (err) {
      console.warn(`[Billing] Firestore subscription update failed:`, err);
    }
  }
}
