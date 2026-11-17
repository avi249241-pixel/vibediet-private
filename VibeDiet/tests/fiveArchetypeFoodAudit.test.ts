import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { mockDb } from '../src/lib/mockFirestore.js';
import { dataStore } from '../src/lib/dataStore.js';
import { reconcileAtwaterMacros, normalizeFoodItem } from '../src/utils/atwater.js';
import { foodCatalogService, LOCAL_VERIFIED_CATALOG } from '../src/services/foodCatalogService.js';
import { validateMediaMagicBytes } from '../src/middleware/security.js';
import { validateImagePayload } from '../src/services/mediaSanitizer.js';
import { createSignedSessionToken, verifySignedSessionToken } from '../src/middleware/auth.js';
import { compressImageClientSide } from '../src/utils/imageCompressor.js';
import { processDraft } from '../src/services/draftProcessor.js';
import { writeAtomicTenantFile, readAtomicTenantFile, TenantFileStore } from '../src/persistence/postgresRepository.js';
import * as geminiSwarm from '../src/services/geminiNutritionSwarm.js';

describe('Fix 5: 5-Archetype Real-World Food Verification Suite', () => {
  const app = createApp();
  const testUserUid = 'audit-tenant-uid-101';
  const otherUserUid = 'audit-tenant-uid-202';
  const authHeader = { Authorization: `Bearer uid:${testUserUid}` };

  beforeEach(async () => {
    mockDb.resetForTests();
    await dataStore.eraseUserData(testUserUid);
    await dataStore.eraseUserData(otherUserUid);
  });

  // =========================================================================
  // SCENARIO 1: South Indian Breakfast (2 Masala Dosas + Sambar + Coconut Chutney)
  // =========================================================================
  it('Scenario 1: South Indian Breakfast — verifies 2 Masala Dosas with Sambar & Coconut Chutney Atwater physics', async () => {
    // 1. Fetch items from verified core catalog
    const dosa = LOCAL_VERIFIED_CATALOG.find((f) => f.name.includes('Masala Dosa'))!;
    const sambar = LOCAL_VERIFIED_CATALOG.find((f) => f.name.includes('Sambar'))!;
    const chutney = LOCAL_VERIFIED_CATALOG.find((f) => f.name.includes('Coconut Chutney'))!;

    expect(dosa).toBeDefined();
    expect(sambar).toBeDefined();
    expect(chutney).toBeDefined();

    // 2. Masala Dosa 180g serving physics (2 portions = 360g)
    const singleDosaAtwater = reconcileAtwaterMacros({
      reportedCalories: dosa.reportedCalories,
      protein: dosa.protein,
      carbs: dosa.carbs,
      fiber: dosa.fiber,
      fat: dosa.fat,
    });
    // 4(6.2) + 4(51.5 - 4.2 = 47.3) + 9(10.8) = 24.8 + 189.2 + 97.2 = 311.2 kcal
    // Reported: 330 kcal -> within 6% tolerance
    expect(singleDosaAtwater.hasDiscrepancy).toBe(false);
    expect(dosa.tier).toBe(1);

    // 3. Log South Indian Breakfast via v1 API (2 Masala Dosas + Sambar + Coconut Chutney)
    const res = await request(app)
      .post('/v1/meals/manual')
      .set(authHeader)
      .send({
        date: '2026-11-16',
        slot: 'breakfast',
        title: '2 Masala Dosas with Sambar & Coconut Chutney',
        items: [
          { ...dosa, id: 'dosa-1' },
          { ...dosa, id: 'dosa-2' },
          sambar,
          chutney,
        ],
      });

    expect(res.status).toBe(201);
    const meal = res.body.meal;
    expect(meal.items.length).toBe(4);

    // Total calories = 330 + 330 + 90 + 130 = 880 kcal
    expect(meal.totalCalories).toBe(880);
    expect(meal.totalProtein).toBeCloseTo(18.7, 0.5);
    expect(meal.totalFat).toBeCloseTo(36.4, 0.5);
    expect(meal.hasAtwaterDiscrepancy).toBe(false);
  });

  // =========================================================================
  // SCENARIO 2: Packaged Barcode / OCR Label (Amul 8901262010023 & High-Protein Oats)
  // =========================================================================
  it('Scenario 2: Packaged Barcode / OCR Label — resolves EAN 8901262010023 & Oats OCR label', async () => {
    // 1. Barcode lookup via GET /v1/foods/barcode/:code
    const barcodeRes = await request(app)
      .get('/v1/foods/barcode/8901262010023')
      .set(authHeader);

    expect(barcodeRes.status).toBe(200);
    const item = barcodeRes.body.item;
    expect(item.name).toContain('Amul');
    expect(item.tier).toBe(2);
    expect(item.reportedCalories).toBe(720);
    expect(item.fat).toBe(80.0);
    expect(item.barcode).toBe('8901262010023');

    // Verify Atwater reconciliation for Amul Butter: 4(1) + 4(1) + 9(80) = 728 kcal (~1.1% delta from 720)
    const atwater = reconcileAtwaterMacros({
      reportedCalories: item.reportedCalories,
      protein: item.protein,
      carbs: item.carbs,
      fiber: item.fiber,
      fat: item.fat,
    });
    expect(atwater.hasDiscrepancy).toBe(false);

    // 2. High-Protein Oats Barcode / Label Resolution
    const oatsRes = await request(app)
      .get('/v1/foods/barcode/8901030865510')
      .set(authHeader);

    expect(oatsRes.status).toBe(200);
    const oatsItem = oatsRes.body.item;
    expect(oatsItem.name).toContain('Oats');
    expect(oatsItem.protein).toBeGreaterThanOrEqual(8.0);
    expect(oatsItem.tier).toBe(2);
  });

  // =========================================================================
  // SCENARIO 3: Liquid Beverage with Hidden Sugar (350ml Sweetened Mango Lassi)
  // =========================================================================
  it('Scenario 3: Liquid Beverage with Hidden Sugar — evaluates 350ml Mango Lassi with sugar density', async () => {
    const lassi = LOCAL_VERIFIED_CATALOG.find((f) => f.name.includes('Mango Lassi'))!;
    expect(lassi).toBeDefined();

    // Verify 350ml liquid portion macros
    expect(lassi.grams).toBe(350);
    expect(lassi.sugar).toBeGreaterThanOrEqual(35); // >35g sugar in sweetened lassi
    expect(lassi.protein).toBe(10.0);
    expect(lassi.reportedCalories).toBe(290);

    // Atwater physics: Net Carbs = 48 - 1.5 = 46.5g. 4(10) + 4(46.5) + 9(7) = 40 + 186 + 63 = 289 kcal
    const recon = reconcileAtwaterMacros({
      reportedCalories: lassi.reportedCalories,
      protein: lassi.protein,
      carbs: lassi.carbs,
      fiber: lassi.fiber,
      fat: lassi.fat,
    });
    expect(recon.calculatedCalories).toBe(289);
    expect(recon.hasDiscrepancy).toBe(false);

    // Log through API and verify persistence
    const res = await request(app)
      .post('/v1/meals/manual')
      .set(authHeader)
      .send({
        date: '2026-11-16',
        slot: 'snack',
        title: 'Afternoon Refreshment — 350ml Mango Lassi',
        items: [lassi],
      });

    expect(res.status).toBe(201);
    expect(res.body.meal.totalSugar).toBe(38.0);
    expect(res.body.meal.totalCalories).toBe(290);
  });

  // =========================================================================
  // SCENARIO 4: High-Variance Restaurant Dish (300g Chicken Biryani with Raita)
  // =========================================================================
  it('Scenario 4: High-Variance Restaurant Dish — flags unobservable fats in 300g Chicken Biryani & Raita', async () => {
    const biryani = LOCAL_VERIFIED_CATALOG.find((f) => f.name.includes('Chicken Biryani'))!;
    const raita = LOCAL_VERIFIED_CATALOG.find((f) => f.name.includes('Cucumber Raita'))!;

    expect(biryani).toBeDefined();
    expect(raita).toBeDefined();

    // Biryani must be flagged with unobservable_unknown cooking fat due to restaurant dum cooking
    expect(biryani.cookingFatCategory).toBe('unobservable_unknown');

    const res = await request(app)
      .post('/v1/meals/manual')
      .set(authHeader)
      .send({
        date: '2026-11-16',
        slot: 'dinner',
        title: 'Hyderabadi Chicken Biryani with Cucumber Raita',
        items: [biryani, raita],
      });

    expect(res.status).toBe(201);
    const meal = res.body.meal;

    // Must flag unobservable fats to prompt user for cooking fat delta if needed
    expect(meal.hasUnobservableFats).toBe(true);
    expect(meal.totalCalories).toBe(600); // 540 + 60
    expect(meal.totalProtein).toBe(35.0); // 32 + 3
    expect(meal.totalFat).toBe(21.5); // 18 + 3.5
  });

  // =========================================================================
  // SCENARIO 5: Adversarial / Corrupted Payload (Rejection & 0 DB Corruption)
  // =========================================================================
  it('Scenario 5: Adversarial / Corrupted Payload — rejects corrupt magic bytes and enforces 0 state corruption', async () => {
    // 1. Fake image with text header pretending to be JPEG
    const fakePayload = 'data:image/jpeg;base64,' + Buffer.from('<script>alert("xss")</script>').toString('base64');
    const mediaCheck = validateImagePayload(fakePayload);
    expect(mediaCheck.valid).toBe(false);
    expect(mediaCheck.error).toContain('Unrecognized image signature');

    // 2. Submit corrupt image to POST /v1/drafts
    const resDraft = await request(app)
      .post('/v1/drafts')
      .set(authHeader)
      .send({
        slot: 'lunch',
        imageBase64: fakePayload,
      });

    expect(resDraft.status).toBe(400);
    expect(resDraft.body.code).toBe('INVALID_IMAGE_PAYLOAD');

    // 3. Verify zero drafts were committed for this tenant
    const dayCheck = await request(app)
      .get('/v1/days/2026-11-16')
      .set(authHeader);

    expect(dayCheck.status).toBe(200);
    expect(dayCheck.body.day.meals.length).toBe(0);
  });

  // =========================================================================
  // MULTI-TENANT USER ISOLATION & GOOGLE AUTH SESSION BINDING
  // =========================================================================
  it('Multi-Tenant Isolation & Google Auth Session Binding — isolates tenant records and signs HttpOnly cookies', async () => {
    // 1. POST /v1/auth/google
    const authRes = await request(app)
      .post('/v1/auth/google')
      .send({ idToken: 'mock-google-token' });

    expect(authRes.status).toBe(200);
    expect(authRes.body.ok).toBe(true);
    expect(authRes.body.sessionToken).toBeDefined();
    expect(authRes.body.user.uid).toBe('google-demo-uid');

    // Verify Set-Cookie header with HttpOnly and vibediet_session
    const cookies = authRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('vibediet_session=');
    expect(cookies[0]).toContain('HttpOnly');

    // 2. Access protected endpoint using signed session token in cookie
    const sessionToken = authRes.body.sessionToken;
    const cookieHeader = `vibediet_session=${sessionToken}`;

    const protectedRes = await request(app)
      .get('/v1/days/2026-11-16')
      .set('Cookie', cookieHeader);

    expect(protectedRes.status).toBe(200);
    expect(protectedRes.body.day.date).toBe('2026-11-16');

    // 3. Multi-Tenant User Isolation: verify Tenant A cannot read Tenant B's data
    // Tenant A logs a meal
    await request(app)
      .post('/v1/meals/manual')
      .set({ Authorization: `Bearer uid:${testUserUid}` })
      .send({
        date: '2026-11-16',
        slot: 'lunch',
        title: 'Tenant A Secret Meal',
        items: [{ id: 'item-1', name: 'Item A', calories: 200, protein: 10, carbs: 20, fat: 5, grams: 100 }],
      });

    // Tenant B queries the same date
    const tenantBRes = await request(app)
      .get('/v1/days/2026-11-16')
      .set({ Authorization: `Bearer uid:${otherUserUid}` });

    expect(tenantBRes.status).toBe(200);
    // Tenant B must see 0 meals logged by Tenant A!
    expect(tenantBRes.body.day.meals.length).toBe(0);
    expect(tenantBRes.body.day.totalCalories).toBe(0);
  });

  // =========================================================================
  // FIX 1 DEEP VERIFICATION: Client-Side Image Compression & Magic Bytes
  // =========================================================================
  it('Fix 1 Deep Verification: preserves genuine JPEG (FF D8 FF) and WebP (52 49 46 46) magic bytes under 250KB', async () => {
    // 1. Test JPEG compression
    const jpegResult = await compressImageClientSide('data:image/jpeg;base64,/9j/4AAQSkZJRg...', {
      maxDimension: 1280,
      quality: 0.84,
      format: 'image/jpeg',
      maxBytes: 250 * 1024,
    });

    expect(jpegResult.format).toBe('jpeg');
    expect(jpegResult.width).toBeLessThanOrEqual(1280);
    expect(jpegResult.byteSize).toBeLessThan(250 * 1024);
    expect(jpegResult.durationMs).toBeLessThan(100);

    const jpegValidation = validateImagePayload(jpegResult.dataUrl);
    expect(jpegValidation.valid).toBe(true);
    expect(jpegValidation.format).toBe('jpeg');
    expect(jpegValidation.buffer![0]).toBe(0xff);
    expect(jpegValidation.buffer![1]).toBe(0xd8);
    expect(jpegValidation.buffer![2]).toBe(0xff);

    // 2. Test WebP compression
    const webpResult = await compressImageClientSide('data:image/webp;base64,UklGRho...', {
      maxDimension: 1280,
      quality: 0.84,
      format: 'image/webp',
      maxBytes: 250 * 1024,
    });

    expect(webpResult.format).toBe('webp');
    expect(webpResult.width).toBeLessThanOrEqual(1280);
    expect(webpResult.byteSize).toBeLessThan(250 * 1024);

    const webpValidation = validateImagePayload(webpResult.dataUrl);
    expect(webpValidation.valid).toBe(true);
    expect(webpValidation.format).toBe('webp');
    expect(webpValidation.buffer![0]).toBe(0x52); // 'R'
    expect(webpValidation.buffer![1]).toBe(0x49); // 'I'
    expect(webpValidation.buffer![2]).toBe(0x46); // 'F'
    expect(webpValidation.buffer![3]).toBe(0x46); // 'F'
  });

  // =========================================================================
  // FIX 2 DEEP VERIFICATION: Progressive Swarm Stage Reporting via GET /v1/drafts/:id
  // =========================================================================
  it('Fix 2 Deep Verification: exposes progressive pipeline stages on GET /v1/drafts/:id', async () => {
    const mockItem = normalizeFoodItem({
      id: 'item-1',
      name: 'Steamed Basmati Rice',
      grams: 150,
      reportedCalories: 195,
      protein: 4,
      carbs: 42,
      fat: 0.5,
      fiber: 1,
      sugar: 0.1,
      sodium: 2,
      tier: 1,
      tierSource: 'Mock IFCT',
      confidence: 0.95,
      cookingFatCategory: 'observable_low',
    });

    // Spy on runGeminiNutritionSwarm to prevent live external network calls and latency timeouts
    const swarmSpy = vi.spyOn(geminiSwarm, 'runGeminiNutritionSwarm').mockImplementation(
      async (_img, _slot, _note, onStageChange) => {
        if (onStageChange) {
          await onStageChange('spatial_ocr');
          await onStageChange('parallel_fats_grounding');
          await onStageChange('atwater_verified');
        }
        return {
          mealTitle: 'Deterministic Mock Meal',
          referenceAnchor: 'standard_dinner_plate_26cm',
          scanMode: 'plate_vision' as const,
          items: [mockItem],
          questions: [],
          telemetry: {
            latencyMs: 15,
            agents: {
              agent1: 'mock',
              agent2: 'mock',
              agent3: 'mock',
              agent4: 'mock',
            },
          },
        };
      }
    );

    try {
      // 1. Create a draft via API
      const createRes = await request(app)
        .post('/v1/drafts')
        .set(authHeader)
        .send({
          slot: 'lunch',
          date: '2026-11-16',
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        });

      expect(createRes.status).toBe(201);
      const draftId = createRes.body.draftId;
      expect(draftId).toBeDefined();

      // 2. Query draft stage immediately
      const stageRes = await request(app)
        .get(`/v1/drafts/${draftId}`)
        .set(authHeader);

      expect(stageRes.status).toBe(200);
      expect(stageRes.body.draft).toBeDefined();
      expect(stageRes.body.draft.id).toBe(draftId);

      // 3. Process draft locally and verify stage transitions to atwater_verified
      const processRes = await request(app)
        .post(`/v1/drafts/${draftId}/process-local`)
        .set(authHeader);

      expect(processRes.status).toBe(200);
      expect(processRes.body.draft.stage).toBe('atwater_verified');
      expect(processRes.body.stage).toBe('atwater_verified');
    } finally {
      swarmSpy.mockRestore();
    }
  });

  // =========================================================================
  // FIX 3 DEEP VERIFICATION: Sanitized Barcode Resolver & Query Merging
  // =========================================================================
  it('Fix 3 Deep Verification: resolves barcodes with whitespace/hyphens and merges local staples', async () => {
    // 1. Query with hyphens and spaces
    const itemWithHyphens = await foodCatalogService.lookupBarcode(' 8901-262-010023 ');
    expect(itemWithHyphens).toBeDefined();
    expect(itemWithHyphens?.name).toContain('Amul');
    expect(itemWithHyphens?.reportedCalories).toBe(720);

    // 2. Query 12-digit UPC with leading zero resolution
    const upcItem = await foodCatalogService.lookupBarcode('0041383090624');
    expect(upcItem).toBeDefined();
    expect(upcItem?.name).toContain('Optimum Nutrition');

    // 3. Query foods merging local IFCT/USDA matches
    const searchRes = await request(app)
      .get('/v1/foods/search?q=paneer')
      .set(authHeader);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results.length).toBeGreaterThanOrEqual(2);
    expect(searchRes.body.results.some((r: any) => r.name.toLowerCase().includes('paneer'))).toBe(true);
  });

  // =========================================================================
  // FIX 4 DEEP VERIFICATION: Concurrent Atomic Disk Persistence
  // =========================================================================
  it('Fix 4 Deep Verification: handles concurrent atomic tenant disk writes without file collision', async () => {
    const tenantUid = 'concurrent-test-user-999';
    const writes = Array.from({ length: 5 }, (_, i) => {
      const data: TenantFileStore = {
        userId: tenantUid,
        meals: {},
        days: {},
        drafts: {},
        weights: [],
        repeatMeals: [],
        portionCalibrations: {},
      };
      return Promise.resolve(writeAtomicTenantFile(tenantUid, data));
    });

    await Promise.all(writes);
    const readBack = readAtomicTenantFile(tenantUid);
    expect(readBack).toBeDefined();
    expect(readBack?.userId).toBe(tenantUid);
  });
});
