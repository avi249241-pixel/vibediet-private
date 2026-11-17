import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { mockDb } from '../src/lib/mockFirestore.js';

describe('Express v1 Transactional Meals, Repeat Library & Weights API', () => {
  const app = createApp();
  const auth = { Authorization: 'Bearer uid:test-user-1' };

  beforeEach(() => {
    mockDb.resetForTests();
  });

  it('logs a manual meal and transactionally updates day totals', async () => {
    const res = await request(app)
      .post('/v1/meals/manual')
      .set(auth)
      .send({
        date: '2026-10-25',
        slot: 'dinner',
        title: 'Grilled Salmon & Quinoa',
        items: [
          {
            name: 'Atlantic Salmon Fillet',
            grams: 180,
            tier: 1,
            reportedCalories: 367,
            protein: 39.8,
            carbs: 0,
            fat: 22.0,
            fiber: 0,
            sugar: 0,
            sodium: 110,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.meal.totalProtein).toBe(39.8);
    expect(res.body.day.meals.some((m: any) => m.title === 'Grilled Salmon & Quinoa')).toBe(true);
  });

  it('copies a repeat meal to target date and deletes a meal transactionally', async () => {
    const repeats = await request(app).get('/v1/repeat-meals').set(auth);
    expect(repeats.status).toBe(200);
    const firstRepeatId = repeats.body.repeatMeals[0].id;

    const copied = await request(app)
      .post('/v1/meals/copy')
      .set(auth)
      .send({
        sourceMealId: firstRepeatId,
        targetDate: '2026-10-25',
        targetSlot: 'snack',
      });
    expect(copied.status).toBe(201);

    const deleted = await request(app)
      .delete(`/v1/meals/${copied.body.meal.id}`)
      .set(auth);
    expect(deleted.status).toBe(200);
  });

  it('logs scale weight and returns updated alpha=0.12 EWMA trend', async () => {
    const res = await request(app)
      .post('/v1/weights')
      .set(auth)
      .send({ date: '2026-10-26', weightKg: 76.0 });
    expect(res.status).toBe(201);
    expect(res.body.entry.smoothedWeightKg).toBeGreaterThan(75);
  });

  it('persists hydration water volume transactionally on /v1/days/:date/water', async () => {
    const res = await request(app)
      .post('/v1/days/2026-10-25/water')
      .set(auth)
      .send({ deltaMl: 250 });
    expect(res.status).toBe(200);
    expect(res.body.day.waterMl).toBeGreaterThanOrEqual(250);

    const getRes = await request(app).get('/v1/days/2026-10-25').set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.day.waterMl).toBe(res.body.day.waterMl);
  });

  it('updates biometrics and recalculates BMR and floors on /v1/biometrics', async () => {
    const putRes = await request(app)
      .put('/v1/biometrics')
      .set(auth)
      .send({
        age: 30,
        gender: 'female',
        heightCm: 165,
        weightKg: 60,
        activityLevel: 'moderately_active',
        goalMode: 'aggressive_cut',
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.biometrics.bmr).toBeGreaterThan(1200);
    // Female aggressive cut floor must be at least 1200 kcal
    expect(putRes.body.biometrics.targetCalories).toBeGreaterThanOrEqual(1200);

    const getRes = await request(app).get('/v1/biometrics').set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.biometrics.weightKg).toBe(60);
  });

  it('exports user data bundle conforming to GDPR/DPDP and verifies full erasure', async () => {
    const exportRes = await request(app).get('/v1/user/export').set(auth);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.uid).toBe('test-user-1');
    expect(Array.isArray(exportRes.body.data.weights)).toBe(true);

    const deleteRes = await request(app).delete('/v1/user/data').set(auth);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const postDeleteDays = await request(app).get('/v1/days/2026-10-25').set(auth);
    expect(postDeleteDays.status).toBe(200);
    expect(postDeleteDays.body.day.meals.length).toBe(0);
  });

  it('simulates signed sandbox webhook and upgrades user subscription', async () => {
    const res = await request(app)
      .post('/v1/billing/simulate-webhook')
      .set(auth)
      .send({ plan: 'annual', gateway: 'razorpay' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.simulated).toBe(true);
  });
});
