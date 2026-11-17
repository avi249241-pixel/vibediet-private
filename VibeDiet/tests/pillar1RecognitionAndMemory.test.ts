import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { mockDb } from '../src/lib/mockFirestore.js';
import {
  savePortionCalibration,
  getPortionCalibration,
  getAllPortionCalibrations,
  clearUserPortionCalibrations,
} from '../src/services/portionMemory.js';
import { validateMediaMagicBytes, secureZeroMemory } from '../src/middleware/security.js';

describe('Pillar 1: Multimodal Fusion, Packaged Label OCR & Portion Memory', () => {
  const app = createApp();
  const auth = { Authorization: 'Bearer uid:test-pilot-uid' };

  beforeEach(() => {
    mockDb.resetForTests();
    clearUserPortionCalibrations('test-pilot-uid');
  });

  it('validates genuine JPEG, PNG, and WebP magic byte headers and rejects invalid payloads', () => {
    // Valid JPEG: FF D8 FF
    const validJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJ';
    expect(validateMediaMagicBytes(validJpeg).isValid).toBe(true);

    // Valid PNG: 89 50 4E 47
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(validateMediaMagicBytes(validPng).isValid).toBe(true);

    // Valid WebP: RIFF ... WEBP
    const validWebp = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    expect(validateMediaMagicBytes(validWebp).isValid).toBe(true);

    // Invalid format
    const invalidText = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
    expect(validateMediaMagicBytes(invalidText).isValid).toBe(false);
  });

  it('securely zeroes memory buffers on request', () => {
    const buf = Buffer.from('sensitive_image_data_in_ram');
    secureZeroMemory(buf);
    expect(buf.every((byte) => byte === 0)).toBe(true);
  });

  it('saves and applies Personal Portion Calibration Memory across scans', () => {
    savePortionCalibration('test-pilot-uid', 'dal tadka', 240, '1 tsp desi ghee');
    const cal = getPortionCalibration('test-pilot-uid', 'Dal Tadka');
    expect(cal).toBeDefined();
    expect(cal?.calibratedGrams).toBe(240);
    expect(cal?.oilModifier).toBe('1 tsp desi ghee');

    const all = getAllPortionCalibrations('test-pilot-uid');
    expect(all.length).toBe(1);
    expect(all[0].foodKey).toBe('dal tadka');
  });

  it('accepts contextNote in POST /v1/drafts alongside photo and processes draft with portion memory', async () => {
    const res = await request(app)
      .post('/v1/drafts')
      .set(auth)
      .send({
        date: '2026-10-25',
        slot: 'dinner',
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
        contextNote: 'Cooked in 2 tsp desi ghee, low-fat paneer',
        scanMode: 'plate_vision',
      });

    expect(res.status).toBe(201);
    expect(res.body.draftId).toBeDefined();
    expect(res.body.draft.contextNote).toBe('Cooked in 2 tsp desi ghee, low-fat paneer');

    // Pre-seed portion calibration for Tikka
    savePortionCalibration('test-pilot-uid', 'Char-Grilled Paneer / Chicken Tikka Skewers', 220);

    const processed = await request(app)
      .post(`/v1/drafts/${res.body.draftId}/process-local`)
      .set(auth);

    expect(processed.status).toBe(200);
    const tikka = processed.body.draft.recognizedItems.find(
      (i: any) => i.name === 'Char-Grilled Paneer / Chicken Tikka Skewers'
    );
    expect(tikka).toBeDefined();
    expect(tikka.grams).toBe(220);
    expect(tikka.tier).toBe(3);
    expect(tikka.tierSource).toBe('Personal Portion Calibration Memory');
  }, 15000);

  it('manages portion calibrations via GET /v1/portions and POST /v1/portions', async () => {
    const postRes = await request(app)
      .post('/v1/portions')
      .set(auth)
      .send({ foodName: 'Home Phulka Roti', grams: 35 });
    expect(postRes.status).toBe(201);
    expect(postRes.body.calibration.calibratedGrams).toBe(35);

    const getRes = await request(app).get('/v1/portions').set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.calibrations.length).toBeGreaterThanOrEqual(1);
  });
});
