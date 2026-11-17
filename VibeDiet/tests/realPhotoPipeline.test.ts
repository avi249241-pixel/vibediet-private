import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { mockDb } from '../src/lib/mockFirestore.js';

describe('Asynchronous Photo Draft Lifecycle & Ephemeral Image Purge', () => {
  const app = createApp();
  const auth = { Authorization: 'Bearer uid:photo-tester' };

  beforeEach(() => {
    mockDb.resetForTests();
  });

  it('queues photo draft, processes recognition, applies clarifying answers, and purges raw image on confirm', async () => {
    const created = await request(app)
      .post('/v1/drafts')
      .set(auth)
      .send({
        date: '2026-10-25',
        slot: 'lunch',
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
      });
    expect(created.status).toBe(201);
    const draftId = created.body.draftId;

    const processed = await request(app)
      .post(`/v1/drafts/${draftId}/process-local`)
      .set(auth);
    expect(processed.status).toBe(200);
    expect(processed.body.draft.status).toBe('ready_for_review');
    expect(processed.body.draft.recognizedItems.length).toBeGreaterThan(0);

    const clarified = await request(app)
      .post(`/v1/drafts/${draftId}/clarify`)
      .set(auth)
      .send({
        answers: { 'q-cooking-fat': 'opt-rest-ghee' },
      });
    expect(clarified.status).toBe(200);

    // Verify targetItemId binding: q-cooking-fat targets rec-dal-3 (index 2), NOT index 0 (rec-tikka-1)
    const items = clarified.body.draft.recognizedItems;
    const tikkaItem = items.find((i: any) => i.id === 'rec-tikka-1');
    const dalItem = items.find((i: any) => i.id === 'rec-dal-3');
    expect(tikkaItem.fat).toBe(16.0); // Untouched
    expect(dalItem.fat).toBeGreaterThan(20); // Dal fat increased by +15g from ghee finish

    const confirmed = await request(app)
      .post(`/v1/drafts/${draftId}/confirm`)
      .set(auth)
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.ephemeralImagePurged).toBe(true);
    expect(confirmed.body.meal.totalCalories).toBeGreaterThan(500);
  }, 20000);

  it('processes natural language text meal via POST /v1/drafts/text, applies clarifying answers, and confirms meal', async () => {
    const created = await request(app)
      .post('/v1/drafts/text')
      .set(auth)
      .send({
        mealDescription: '2 phulka rotis, 1 katori dal tadka, 150g paneer bhurji',
        slotHint: 'dinner',
        date: '2026-10-25',
      });

    expect(created.status).toBe(201);
    expect(created.body.draftId).toBeDefined();
    expect(created.body.draft.status).toBe('ready_for_review');
    expect(created.body.draft.recognizedItems.length).toBeGreaterThan(0);
    expect(created.body.draft.questions.length).toBeGreaterThan(0);

    const draftId = created.body.draftId;

    const clarified = await request(app)
      .post(`/v1/drafts/${draftId}/clarify`)
      .set(auth)
      .send({
        answers: { 'q-cooking-fat': 'opt-rest-ghee' },
      });
    expect(clarified.status).toBe(200);

    const confirmed = await request(app)
      .post(`/v1/drafts/${draftId}/confirm`)
      .set(auth)
      .send({
        title: 'Voice/Text Logged Indian Dinner',
      });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.meal.title).toBe('Voice/Text Logged Indian Dinner');
    expect(confirmed.body.meal.totalCalories).toBeGreaterThan(0);
    expect(confirmed.body.day.meals.some((m: any) => m.title === 'Voice/Text Logged Indian Dinner')).toBe(true);
  });
});
