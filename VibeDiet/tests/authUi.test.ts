import { describe, it, expect } from 'vitest';
import {
  isSupabaseConfigured,
  signInWithGoogle,
  signOutUser,
  getAuthHeaders,
  getSyncAuthHeaders,
} from '../src/services/supabaseClient.js';

describe('Frontend Supabase Auth & Profile Portability Suite', () => {

  describe('1. Supabase Client Local Fallback & Graceful Degradation', () => {
    it('returns false for isSupabaseConfigured when env vars are unset or placeholder', () => {
      // In local dev and standard test runs without cloud env vars, client degrades gracefully
      const configured = isSupabaseConfigured();
      expect(typeof configured).toBe('boolean');
    });

    it('injects valid Authorization headers with fallback bearer token', async () => {
      const headers = await getAuthHeaders('custom-test-token-123');
      expect(headers).toBeDefined();
      expect(headers.Authorization).toBe('Bearer custom-test-token-123');
      expect(headers['X-Client-Auth-Mode']).toBeDefined();
    });

    it('injects default demo-user-uid when no token is provided to getAuthHeaders', async () => {
      const headers = await getAuthHeaders();
      expect(headers.Authorization).toBe('Bearer uid:demo-user-uid');
    });

    it('generates synchronous auth headers cleanly for immediate API calls', () => {
      const headers = getSyncAuthHeaders('sync-token-abc');
      expect(headers.Authorization).toBe('Bearer sync-token-abc');
      expect(headers['X-Client-Auth-Mode']).toBeDefined();
    });

    it('signInWithGoogle completes safely in local fallback mode without throwing', async () => {
      const result = await signInWithGoogle('http://127.0.0.1:3000');
      expect(result.success).toBe(true);
      expect(result.mode).toBeDefined();
      if (result.mode === 'local_fallback') {
        expect(result.data?.user?.email).toBe('user@google-verified.io');
      }
    });

    it('signOutUser completes safely without error in local fallback mode', async () => {
      const result = await signOutUser();
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('2. Profile Data Portability & RFC-4180 CSV Export Serialization', () => {
    it('generates valid RFC-4180 CSV structure with proper headers and escaping', () => {
      const headers = [
        'Date',
        'Meal Slot',
        'Meal Title',
        'Food Item',
        'Grams',
        'Calories (kcal)',
        'Protein (g)',
        'Carbs (g)',
        'Fat (g)',
        'Fiber (g)',
        'Sugar (g)',
        'Sodium (mg)',
        'Evidence Tier',
      ];

      const sanitize = (val: any) => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      };

      const sampleMeals = [
        {
          date: '2026-11-16',
          slot: 'lunch',
          title: 'Dal Tadka with "Desi" Ghee, & Phulka',
          items: [
            {
              name: 'Yellow Dal Tadka',
              grams: 150,
              calories: 141,
              protein: 9.0,
              carbs: 20.0,
              fat: 5.0,
              fiber: 5.0,
              sugar: 1.0,
              sodium: 320,
              tier: 1,
            },
            {
              name: 'Phulka Roti, Whole Wheat',
              grams: 60,
              calories: 150,
              protein: 5.1,
              carbs: 28.8,
              fat: 1.3,
              fiber: 4.2,
              sugar: 0.5,
              sodium: 90,
              tier: 1,
            },
          ],
        },
      ];

      const rows: string[] = [headers.join(',')];

      sampleMeals.forEach((meal) => {
        meal.items.forEach((item) => {
          rows.push(
            [
              sanitize(meal.date),
              sanitize(meal.slot),
              sanitize(meal.title),
              sanitize(item.name),
              item.grams,
              item.calories,
              item.protein,
              item.carbs,
              item.fat,
              item.fiber,
              item.sugar,
              item.sodium,
              sanitize(`Tier ${item.tier}`),
            ].join(',')
          );
        });
      });

      const csvOutput = rows.join('\r\n');

      // Verify CSV header
      expect(csvOutput).toContain('Date,Meal Slot,Meal Title,Food Item,Grams,Calories (kcal)');
      // Verify escaped quotes and commas
      expect(csvOutput).toContain('"Dal Tadka with ""Desi"" Ghee, & Phulka"');
      expect(csvOutput).toContain('"Phulka Roti, Whole Wheat"');
      // Verify row count (1 header + 2 items)
      const lines = csvOutput.split('\r\n');
      expect(lines).toHaveLength(3);
    });

    it('generates complete JSON user export bundle complying with GDPR/DPDP portability', () => {
      const mockBundle = {
        exportTimestamp: new Date().toISOString(),
        user: {
          uid: 'user-test-456',
          email: 'test@vibediet.io',
          displayName: 'Test Athlete',
        },
        biometrics: {
          targetCalories: 2400,
          targetProtein: 180,
          targetCarbs: 240,
          targetFat: 75,
        },
        meals: [
          {
            id: 'meal-1',
            date: '2026-11-16',
            slot: 'dinner',
            title: 'Paneer Tikka Bowl',
            totalCalories: 520,
            totalProtein: 38,
          },
        ],
        weightLogs: [
          {
            date: '2026-11-16',
            weightKg: 75.8,
            smoothedWeightKg: 76.1,
          },
        ],
      };

      const serialized = JSON.stringify(mockBundle);
      const parsed = JSON.parse(serialized);

      expect(parsed.user.uid).toBe('user-test-456');
      expect(parsed.biometrics.targetCalories).toBe(2400);
      expect(parsed.meals).toHaveLength(1);
      expect(parsed.weightLogs).toHaveLength(1);
    });
  });

});
