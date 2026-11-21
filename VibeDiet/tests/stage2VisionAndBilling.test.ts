import { describe, it, expect, beforeEach } from 'vitest';
import {
  recalculateItemNutrition,
  resolveFoodItem,
  OIL_FAT_GRAMS_MAP,
  type DetectedFoodItem,
  type OilLevel,
} from '../src/vision/index.js';
import {
  AUTHORITATIVE_PLANS,
  checkAiScanQuota,
  computeHmacSha256Hex,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  handleVerifyPayment,
  timingSafeEqualHex,
  FREE_TIER_DAILY_AI_SCAN_LIMIT,
} from '../src/worker/routes/billing.js';

describe('Stage 2: Vision Perception & Edge-Native Razorpay Billing Suite', () => {
  // =========================================================================
  // 1. Structured Schema & IFCT/Atwater Oil-Level Macro Recalculation
  // =========================================================================
  describe('1. Perception & Atwater Oil-Level Macro Recalculation', () => {
    it('validates DetectedFoodItem schema structure and applies IFCT density', () => {
      const detectedItem: DetectedFoodItem = {
        id: 'food-dal-1',
        name: 'Dal Tadka',
        estimatedGrams: 200,
        cookingMethod: 'boiled',
        oilLevel: 'standard',
        confidence: 0.92,
      };

      const resolved = resolveFoodItem(detectedItem);
      expect(resolved.name).toBe('Dal Tadka');
      expect(resolved.grams).toBe(200);
      expect(resolved.oilLevel).toBe('standard');
      expect(resolved.confidence).toBe(0.92);

      // Verify Atwater invariant: 4*P + 4*netCarbs + 9*F === calories
      const netCarbs = Math.max(0, Number((resolved.carbs - (resolved.fiber || 0)).toFixed(1)));
      const expectedKcal = Math.round(
        resolved.protein * 4 + netCarbs * 4 + resolved.fat * 9
      );
      expect(resolved.calories).toBe(expectedKcal);
    });

    it('recalculates macros accurately between "none" and "heavy" ghee/oil sheen', () => {
      const baseItem: DetectedFoodItem = {
        id: 'food-paneer-1',
        name: 'Paneer Bhurji',
        estimatedGrams: 150,
        cookingMethod: 'sauteed',
        oilLevel: 'none',
        confidence: 0.95,
      };

      // 1. None oil level (0g added fat)
      const resolvedNone = resolveFoodItem(baseItem);
      expect(OIL_FAT_GRAMS_MAP['none']).toBe(0);

      // 2. Heavy oil level (+10g added fat = +90 kcal from fat)
      const resolvedHeavy = recalculateItemNutrition(
        resolvedNone,
        resolvedNone.grams,
        'heavy'
      );
      expect(OIL_FAT_GRAMS_MAP['heavy']).toBe(10);

      const fatDifference = resolvedHeavy.fat - resolvedNone.fat;
      expect(fatDifference).toBe(10);

      // Protein and Carbs should remain constant for pure oil adjustments
      expect(resolvedHeavy.protein).toBe(resolvedNone.protein);
      expect(resolvedHeavy.carbs).toBe(resolvedNone.carbs);

      // Calories should strictly follow Atwater 4-4-9 physics: 10g fat * 9 kcal/g = +90 kcal
      const calorieDifference = resolvedHeavy.calories - resolvedNone.calories;
      expect(calorieDifference).toBe(90);

      // Atwater invariant holds on both states
      const netCarbsNone = Math.max(0, Number((resolvedNone.carbs - (resolvedNone.fiber || 0)).toFixed(1)));
      expect(resolvedNone.calories).toBe(
        Math.round(resolvedNone.protein * 4 + netCarbsNone * 4 + resolvedNone.fat * 9)
      );

      const netCarbsHeavy = Math.max(0, Number((resolvedHeavy.carbs - (resolvedHeavy.fiber || 0)).toFixed(1)));
      expect(resolvedHeavy.calories).toBe(
        Math.round(resolvedHeavy.protein * 4 + netCarbsHeavy * 4 + resolvedHeavy.fat * 9)
      );
    });

    it('scales macros proportionally when grams slider adjusts from 100g to 250g', () => {
      const baseItem: DetectedFoodItem = {
        id: 'food-moong-1',
        name: 'Yellow Moong Dal',
        estimatedGrams: 100,
        cookingMethod: 'boiled',
        oilLevel: 'light',
        confidence: 0.88,
      };

      const resolved100g = resolveFoodItem(baseItem);
      const scaled250g = recalculateItemNutrition(resolved100g, 250, 'light');

      expect(scaled250g.grams).toBe(250);
      expect(scaled250g.protein).toBeCloseTo(resolved100g.protein * 2.5, 0);
      expect(scaled250g.carbs).toBeCloseTo(resolved100g.carbs * 2.5, 0);
    });
  });

  // =========================================================================
  // 2. Free Tier 3-Scan Daily Quota vs. Pro Unlimited Bypass
  // =========================================================================
  describe('2. Freemium Tier Gating & Quota Enforcement', () => {
    it('enforces strict 3-scan daily quota for Free tier users', () => {
      expect(FREE_TIER_DAILY_AI_SCAN_LIMIT).toBe(3);

      // 0 scans used
      const quota0 = checkAiScanQuota(false, 0);
      expect(quota0.allowed).toBe(true);
      expect(quota0.remainingScans).toBe(3);
      expect(quota0.dailyLimit).toBe(3);
      expect(quota0.tier).toBe('free');

      // 1 scan used
      const quota1 = checkAiScanQuota(false, 1);
      expect(quota1.allowed).toBe(true);
      expect(quota1.remainingScans).toBe(2);

      // 2 scans used
      const quota2 = checkAiScanQuota(false, 2);
      expect(quota2.allowed).toBe(true);
      expect(quota2.remainingScans).toBe(1);

      // 3 scans used -> Quota hit
      const quota3 = checkAiScanQuota(false, 3);
      expect(quota3.allowed).toBe(false);
      expect(quota3.remainingScans).toBe(0);
      expect(quota3.message).toContain('Daily AI scan quota reached (3/3)');

      // Attempting 4th scan -> strictly denied
      const quota4 = checkAiScanQuota(false, 4);
      expect(quota4.allowed).toBe(false);
      expect(quota4.remainingScans).toBe(0);
    });

    it('bypasses daily scan quota completely for Pro subscribers', () => {
      // 0 scans used
      const pro0 = checkAiScanQuota(true, 0);
      expect(pro0.allowed).toBe(true);
      expect(pro0.tier).toBe('pro');
      expect(pro0.dailyLimit).toBe(Infinity);
      expect(pro0.remainingScans).toBe(Infinity);

      // 3 scans used
      const pro3 = checkAiScanQuota(true, 3);
      expect(pro3.allowed).toBe(true);
      expect(pro3.remainingScans).toBe(Infinity);

      // 50 scans used
      const pro50 = checkAiScanQuota(true, 50);
      expect(pro50.allowed).toBe(true);
      expect(pro50.remainingScans).toBe(Infinity);
      expect(pro50.message).toBeUndefined();
    });

    it('defines authoritative server-side plans preventing client amount tampering', () => {
      expect(AUTHORITATIVE_PLANS.pro_monthly.amountPaise).toBe(14900); // ₹149
      expect(AUTHORITATIVE_PLANS.pro_monthly.currency).toBe('INR');

      expect(AUTHORITATIVE_PLANS.pro_annual.amountPaise).toBe(99900); // ₹999
      expect(AUTHORITATIVE_PLANS.pro_annual.currency).toBe('INR');
    });
  });

  // =========================================================================
  // 3. Razorpay Web Crypto HMAC-SHA256 Signature Verification
  // =========================================================================
  describe('3. Edge-Native Razorpay HMAC-SHA256 Verification', () => {
    const testSecret = 'rzp_test_secret_key_stage2_verification_99182';
    const testOrderId = 'order_DA1234567890AB';
    const testPaymentId = 'pay_XY9876543210CD';

    it('passes valid HMAC-SHA256 signature for authentic Razorpay payment', async () => {
      const payload = `${testOrderId}|${testPaymentId}`;
      const validSig = await computeHmacSha256Hex(testSecret, payload);

      const isValid = await verifyRazorpayPaymentSignature(
        testOrderId,
        testPaymentId,
        validSig,
        testSecret
      );
      expect(isValid).toBe(true);
    });

    it('rejects tampered order_id with 401 unverified status', async () => {
      const payload = `${testOrderId}|${testPaymentId}`;
      const validSig = await computeHmacSha256Hex(testSecret, payload);

      const tamperedOrderId = 'order_TAMPERED_HACK_999';
      const isValid = await verifyRazorpayPaymentSignature(
        tamperedOrderId,
        testPaymentId,
        validSig,
        testSecret
      );
      expect(isValid).toBe(false);
    });

    it('rejects tampered payment_id with 401 unverified status', async () => {
      const payload = `${testOrderId}|${testPaymentId}`;
      const validSig = await computeHmacSha256Hex(testSecret, payload);

      const tamperedPaymentId = 'pay_TAMPERED_PAY_000';
      const isValid = await verifyRazorpayPaymentSignature(
        testOrderId,
        tamperedPaymentId,
        validSig,
        testSecret
      );
      expect(isValid).toBe(false);
    });

    it('rejects tampered or forged signature string', async () => {
      const forgedSig = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const isValid = await verifyRazorpayPaymentSignature(
        testOrderId,
        testPaymentId,
        forgedSig,
        testSecret
      );
      expect(isValid).toBe(false);
    });

    it('verifies Webhook signatures against raw JSON bodies', async () => {
      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: testPaymentId,
              order_id: testOrderId,
              amount: 99900,
              notes: { userId: 'usr_test_123' },
            },
          },
        },
      });

      const validWebhookSig = await computeHmacSha256Hex(testSecret, webhookPayload);

      const isWebhookValid = await verifyRazorpayWebhookSignature(
        webhookPayload,
        validWebhookSig,
        testSecret
      );
      expect(isWebhookValid).toBe(true);

      // Altered webhook payload must fail
      const alteredPayload = webhookPayload.replace('usr_test_123', 'usr_attacker_999');
      const isAlteredValid = await verifyRazorpayWebhookSignature(
        alteredPayload,
        validWebhookSig,
        testSecret
      );
      expect(isAlteredValid).toBe(false);
    });

    it('handleVerifyPayment returns 200 with Pro token on valid signature and 401 on tampered', async () => {
      const payload = `${testOrderId}|${testPaymentId}`;
      const validSig = await computeHmacSha256Hex(testSecret, payload);

      // 1. Valid payment request
      const validReq = new Request('http://localhost/v1/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: testOrderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: validSig,
          userId: 'usr_stage2_subscriber',
        }),
      });

      const validRes = await handleVerifyPayment(validReq, {
        RAZORPAY_KEY_SECRET: testSecret,
      });
      expect(validRes.status).toBe(200);
      const validData = await validRes.json();
      expect(validData.verified).toBe(true);
      expect(validData.isPro).toBe(true);
      expect(validData.tier).toBe('pro');
      expect(validData.signedToken).toBeDefined();

      // 2. Tampered payment request
      const tamperedReq = new Request('http://localhost/v1/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: 'order_TAMPERED',
          razorpay_payment_id: testPaymentId,
          razorpay_signature: validSig,
          userId: 'usr_stage2_subscriber',
        }),
      });

      const tamperedRes = await handleVerifyPayment(tamperedReq, {
        RAZORPAY_KEY_SECRET: testSecret,
      });
      expect(tamperedRes.status).toBe(401);
      const tamperedData = await tamperedRes.json();
      expect(tamperedData.error).toContain('Invalid Razorpay payment signature');
    });

    it('timingSafeEqualHex performs constant-time comparison', () => {
      expect(timingSafeEqualHex('abcdef', 'abcdef')).toBe(true);
      expect(timingSafeEqualHex('ABCDEF', 'abcdef')).toBe(true);
      expect(timingSafeEqualHex('abcdef', 'abcdeg')).toBe(false);
      expect(timingSafeEqualHex('abcdef', 'abcde')).toBe(false);
    });
  });
});
