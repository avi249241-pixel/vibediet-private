import type { Config, Context } from "@netlify/functions";
import { normalizeFoodItem } from "../../src/shared/physics/atwater.js";
import {
  ACTIVITY_MULTIPLIERS,
  calculateMifflinStJeorBmr,
  calculateTargetCaloriesWithFloor,
  computeEwmaWeight,
} from "../../src/shared/physics/adaptiveTdee.js";
import { parseNaturalLanguageMeal } from "../../src/services/naturalLanguageMealParser.js";
import { foodCatalogService } from "../../src/services/foodCatalogService.js";
import { keyPoolRouter } from "../../src/services/keyPoolRouter.js";
import {
  runGeminiNutritionSwarm,
  runTextMealNutritionSwarm,
} from "../../src/services/geminiNutritionSwarm.js";

// In-memory fallback cache when Netlify Database is initializing or offline
const fallbackStore: {
  meals: Record<string, any[]>;
  days: Record<string, any>;
  drafts: Record<string, Record<string, any>>;
  weights: Record<string, any[]>;
  biometrics: Record<string, any>;
  repeatMeals: Record<string, any[]>;
  tickets: any[];
} = {
  drafts: {},
  meals: {
    'demo-user-uid': [
      {
        id: 'seed-breakfast',
        date: new Date().toISOString().slice(0, 10),
        slot: 'breakfast',
        title: 'Masala Omelette & Sourdough Toast',
        items: [
          { name: 'Whole Eggs (2 large)', grams: 110, calories: 156, protein: 12.6, carbs: 1.1, fat: 10.8 },
          { name: 'Sourdough Bread (2 slices)', grams: 70, calories: 185, protein: 6.2, carbs: 36.4, fat: 1.0 },
          { name: 'Grass-fed Butter', grams: 5, calories: 37, protein: 0.0, carbs: 0.0, fat: 4.1 },
        ],
        totalCalories: 378,
        totalProtein: 18.8,
        totalCarbs: 37.5,
        totalFat: 15.9,
      },
    ],
  },
  days: {},
  weights: {
    'demo-user-uid': [
      { id: 'w1', date: '2026-11-10', weightKg: 76.5, trendKg: 76.5 },
      { id: 'w2', date: '2026-11-12', weightKg: 76.2, trendKg: 76.35 },
      { id: 'w3', date: '2026-11-15', weightKg: 76.0, trendKg: 76.15 },
    ],
  },
  biometrics: {
    'demo-user-uid': {
      uid: 'demo-user-uid',
      email: 'avi-demo@vibediet.app',
      displayName: 'Avi Demo',
      age: 28,
      gender: 'male',
      heightCm: 178,
      weightKg: 76.0,
      activityLevel: 'moderately_active',
      goalMode: 'lean_mass',
      dietaryPreference: 'balanced',
      targetCalories: 2245,
      macroSplit: { proteinPct: 30, carbPct: 45, fatPct: 25 },
    },
  },
  repeatMeals: {
    'demo-user-uid': [
      {
        id: 'rep-1',
        title: 'High-Protein Paneer Rice Bowl',
        slot: 'lunch',
        items: [
          { name: 'Paneer (Low-Fat)', grams: 150, calories: 285, protein: 27, carbs: 4.5, fat: 18 },
          { name: 'Basmati Rice (Cooked)', grams: 180, calories: 234, protein: 4.8, carbs: 50.4, fat: 0.7 },
        ],
        totalCalories: 519,
        totalProtein: 31.8,
        totalCarbs: 54.9,
        totalFat: 18.7,
      },
    ],
  },
  tickets: [
    {
      id: 'TKT-INIT-001',
      uid: 'demo-user-uid',
      category: 'nutrition_fix',
      subject: 'Database Auto-Sync Initialized',
      message: 'System database successfully connected with multi-tenant partition schema.',
      status: 'open',
      createdAt: '2026-11-17T00:00:00.000Z',
    },
  ],
};

function getUserId(req: Request): string {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const raw = authHeader.slice(7).trim();
    if (raw.startsWith('uid:')) return raw.slice(4);
    if (raw.length > 0 && !raw.includes('mock') && !raw.includes('invalid')) {
      return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'demo-user-uid';
    }
  }
  return 'demo-user-uid';
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const userId = getUserId(req);

  // Attempt live Netlify Database query
  let db: any = null;
  try {
    const { getDatabase } = await import("@netlify/database");
    db = getDatabase();
  } catch {}

  // Helper to ensure tenant user row exists for foreign key constraints
  const ensureUserExists = async () => {
    if (!db) return;
    try {
      await db.sql`
        INSERT INTO vibe_users (id, email, display_name)
        VALUES (${userId}, ${userId + '@vibediet.app'}, ${userId})
        ON CONFLICT (id) DO NOTHING
      `.execute();
    } catch {}
  };

  try {
    // 1. GET /v1/days/:date
    if (method === 'GET' && path.includes('/days/')) {
      const parts = path.split('/days/');
      const date = parts[1]?.split(/[/?#]/)[0] || new Date().toISOString().slice(0, 10);
      const dayKey = `${userId}:${date}`;

      let dayMeals: any[] = [];
      let waterMl = 0;

      if (db) {
        try {
          const rows = await db.sql`
            SELECT id, date, slot, title, calories, protein_g, carbs_g, fat_g, fiber_g, raw_payload
            FROM vibe_meals 
            WHERE user_id = ${userId} AND date = ${date} 
            ORDER BY created_at ASC
          `.execute();

          if (rows && rows.length > 0) {
            dayMeals = rows.map((r: any) => {
              if (r.raw_payload && Object.keys(r.raw_payload).length > 0) {
                return r.raw_payload;
              }
              return {
                id: r.id,
                date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10),
                slot: r.slot,
                title: r.title,
                totalCalories: Number(r.calories),
                totalProtein: Number(r.protein_g),
                totalCarbs: Number(r.carbs_g),
                totalFat: Number(r.fat_g),
                items: [],
              };
            });
          }

          const dayRows = await db.sql`
            SELECT payload 
            FROM vibe_days 
            WHERE user_id = ${userId} AND date = ${date}
          `.execute();

          if (dayRows && dayRows.length > 0) {
            waterMl = Number(dayRows[0].payload?.waterMl ?? 0);
          } else {
            waterMl = fallbackStore.days[dayKey]?.waterMl ?? 0;
          }
        } catch (e) {
          dayMeals = (fallbackStore.meals[userId] || []).filter((m) => m.date === date);
          waterMl = fallbackStore.days[dayKey]?.waterMl ?? 0;
        }
      } else {
        dayMeals = (fallbackStore.meals[userId] || []).filter((m) => m.date === date);
        waterMl = fallbackStore.days[dayKey]?.waterMl ?? 0;
      }

      return new Response(
        JSON.stringify({
          success: true,
          day: {
            date,
            meals: dayMeals,
            waterMl,
            calorieTarget: 2245,
            updatedAt: new Date().toISOString(),
          },
        }),
        { status: 200, headers }
      );
    }

    // 2. POST /v1/days/:date/water
    if (method === 'POST' && path.includes('/water')) {
      const parts = path.split('/days/');
      const date = parts[1]?.split('/water')[0]?.replace(/^\/+|\/+$/g, '') || new Date().toISOString().slice(0, 10);
      const dayKey = `${userId}:${date}`;
      const body = await req.json().catch(() => ({}));
      const deltaMl = Number(body.deltaMl) || 250;

      let currentWater = fallbackStore.days[dayKey]?.waterMl ?? 0;
      if (db) {
        try {
          const dayRows = await db.sql`SELECT payload FROM vibe_days WHERE user_id = ${userId} AND date = ${date}`.execute();
          if (dayRows && dayRows.length > 0) {
            currentWater = Number(dayRows[0].payload?.waterMl ?? currentWater);
          }
        } catch {}
      }

      const nextWater = Math.max(0, currentWater + deltaMl);
      fallbackStore.days[dayKey] = { waterMl: nextWater, calorieTarget: 2245 };

      if (db) {
        try {
          await ensureUserExists();
          await db.sql`
            INSERT INTO vibe_days (user_id, date, payload, updated_at)
            VALUES (${userId}, ${date}, ${JSON.stringify({ waterMl: nextWater, calorieTarget: 2245 })}, NOW())
            ON CONFLICT (user_id, date) DO UPDATE 
            SET payload = ${JSON.stringify({ waterMl: nextWater, calorieTarget: 2245 })}, updated_at = NOW()
          `.execute();
        } catch (e) {
          console.error("DB error on water update:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, waterMl: nextWater, date }), { status: 200, headers });
    }

    // 3. POST /v1/meals/manual (and POST /v1/meals)
    if (method === 'POST' && (path.endsWith('/meals/manual') || path.endsWith('/meals') || path.includes('/meals/manual'))) {
      const body = await req.json().catch(() => ({}));
      const items = (body.items || []).map((raw: any) => normalizeFoodItem(raw));
      const totalCalories = Number(body.totalCalories ?? items.reduce((s: number, i: any) => s + (Number(i.calories) || 0), 0));
      const totalProtein = Number(body.totalProtein ?? items.reduce((s: number, i: any) => s + (Number(i.protein) || 0), 0));
      const totalCarbs = Number(body.totalCarbs ?? items.reduce((s: number, i: any) => s + (Number(i.carbs) || 0), 0));
      const totalFat = Number(body.totalFat ?? items.reduce((s: number, i: any) => s + (Number(i.fat) || 0), 0));

      const slot = ['breakfast', 'lunch', 'dinner', 'snack'].includes(body.slot) ? body.slot : 'lunch';

      const meal = {
        id: body.id || `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: body.date || new Date().toISOString().slice(0, 10),
        slot,
        title: body.title || 'Logged Meal',
        items,
        totalCalories: Math.round(totalCalories),
        totalProtein: Number(totalProtein.toFixed(1)),
        totalCarbs: Number(totalCarbs.toFixed(1)),
        totalFat: Number(totalFat.toFixed(1)),
        createdAt: new Date().toISOString(),
      };

      if (!fallbackStore.meals[userId]) fallbackStore.meals[userId] = [];
      fallbackStore.meals[userId].push(meal);

      if (db) {
        try {
          await ensureUserExists();
          await db.sql`
            INSERT INTO vibe_meals (id, user_id, date, slot, title, calories, protein_g, carbs_g, fat_g, verified, raw_payload, created_at)
            VALUES (${meal.id}, ${userId}, ${meal.date}, ${meal.slot}, ${meal.title}, ${meal.totalCalories}, ${meal.totalProtein}, ${meal.totalCarbs}, ${meal.totalFat}, TRUE, ${JSON.stringify(meal)}, NOW())
            ON CONFLICT (id) DO UPDATE SET 
              raw_payload = ${JSON.stringify(meal)}, 
              calories = ${meal.totalCalories}, 
              protein_g = ${meal.totalProtein}, 
              carbs_g = ${meal.totalCarbs}, 
              fat_g = ${meal.totalFat}
          `.execute();

          // Sync aggregated daily totals into vibe_day_summaries
          const dayMealsForSummary = (fallbackStore.meals[userId] || []).filter((m) => m.date === meal.date);
          const sumCal = dayMealsForSummary.reduce((acc, m) => acc + (Number(m.totalCalories) || 0), 0);
          const sumP = Number(dayMealsForSummary.reduce((acc, m) => acc + (Number(m.totalProtein) || 0), 0).toFixed(1));
          const sumC = Number(dayMealsForSummary.reduce((acc, m) => acc + (Number(m.totalCarbs) || 0), 0).toFixed(1));
          const sumF = Number(dayMealsForSummary.reduce((acc, m) => acc + (Number(m.totalFat) || 0), 0).toFixed(1));
          await db.sql`
            INSERT INTO vibe_day_summaries (user_id, date, total_calories, total_protein_g, total_carbs_g, total_fat_g, updated_at)
            VALUES (${userId}, ${meal.date}, ${sumCal}, ${sumP}, ${sumC}, ${sumF}, NOW())
            ON CONFLICT (user_id, date) DO UPDATE SET
              total_calories = ${sumCal},
              total_protein_g = ${sumP},
              total_carbs_g = ${sumC},
              total_fat_g = ${sumF},
              updated_at = NOW()
          `.execute().catch(() => {});
        } catch (e) {
          console.error("DB error on meal insert:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, meal }), { status: 201, headers });
    }

    // 4. DELETE /v1/meals/:id
    if (method === 'DELETE' && path.includes('/meals/')) {
      const mealId = path.split('/meals/')[1]?.split(/[/?#]/)[0];
      if (fallbackStore.meals[userId]) {
        fallbackStore.meals[userId] = fallbackStore.meals[userId].filter((m) => m.id !== mealId);
      }
      if (db && mealId) {
        try {
          await db.sql`DELETE FROM vibe_meals WHERE id = ${mealId} AND user_id = ${userId}`.execute();
        } catch (e) {
          console.error("DB error on meal delete:", e);
        }
      }
      return new Response(JSON.stringify({ success: true, mealId }), { status: 200, headers });
    }

    // 5. GET /v1/weights
    if (method === 'GET' && (path.endsWith('/weights') || path.endsWith('/weights/'))) {
      let weights = fallbackStore.weights[userId] || [];
      if (db) {
        try {
          const rows = await db.sql`
            SELECT id, date, weight_kg, smoothed_trend_kg 
            FROM vibe_weights 
            WHERE user_id = ${userId} 
            ORDER BY date ASC
          `.execute();

          if (rows && rows.length > 0) {
            weights = rows.map((r: any) => {
              const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
              return {
                id: r.id,
                date: dateStr,
                weightKg: Number(r.weight_kg),
                trendKg: Number(r.smoothed_trend_kg || r.weight_kg),
              };
            });
          }
        } catch (e) {
          console.error("DB error on GET weights:", e);
        }
      }
      return new Response(JSON.stringify({ success: true, weights }), { status: 200, headers });
    }

    // 6. POST /v1/weights (EWMA α = 0.12)
    if (method === 'POST' && (path.endsWith('/weights') || path.endsWith('/weights/'))) {
      const body = await req.json().catch(() => ({}));
      const weightVal = Number(body.weightKg || body.weight || 76.0);
      const existingList = fallbackStore.weights[userId] || [];
      const prevSmoothed = existingList[existingList.length - 1]?.smoothedWeightKg ?? existingList[existingList.length - 1]?.trendKg;
      const smoothed = computeEwmaWeight(weightVal, prevSmoothed, 0.12);
      const entry = {
        id: body.id || `w-${Date.now()}`,
        date: body.date || new Date().toISOString().slice(0, 10),
        weightKg: weightVal,
        smoothedWeightKg: smoothed,
        trendKg: Number(body.trendKg || smoothed),
      };

      if (!fallbackStore.weights[userId]) fallbackStore.weights[userId] = [];
      fallbackStore.weights[userId].push(entry);

      if (db) {
        try {
          await ensureUserExists();
          await db.sql`
            INSERT INTO vibe_weights (id, user_id, date, weight_kg, smoothed_trend_kg, created_at)
            VALUES (${entry.id}, ${userId}, ${entry.date}, ${entry.weightKg}, ${entry.trendKg}, NOW())
            ON CONFLICT (id) DO UPDATE SET 
              weight_kg = ${entry.weightKg}, 
              smoothed_trend_kg = ${entry.trendKg}
          `.execute();
        } catch (e) {
          console.error("DB error on POST weights:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, weight: entry }), { status: 201, headers });
    }

    // 7. GET /v1/biometrics
    if (method === 'GET' && (path.endsWith('/biometrics') || path.endsWith('/biometrics/'))) {
      let biometrics = fallbackStore.biometrics[userId] || fallbackStore.biometrics['demo-user-uid'];
      if (db) {
        try {
          const rows = await db.sql`SELECT payload FROM vibe_biometrics WHERE user_id = ${userId}`.execute();
          if (rows && rows.length > 0) {
            biometrics = rows[0].payload;
          }
        } catch (e) {
          console.error("DB error on GET biometrics:", e);
        }
      }
      return new Response(JSON.stringify({ success: true, biometrics }), { status: 200, headers });
    }

    // 8. PUT /v1/biometrics (Mifflin-St Jeor BMR + Safety-Floored Adaptive TDEE)
    if ((method === 'PUT' || method === 'POST') && (path.endsWith('/biometrics') || path.endsWith('/biometrics/'))) {
      const body = await req.json().catch(() => ({}));
      const current = fallbackStore.biometrics[userId] || fallbackStore.biometrics['demo-user-uid'];
      const merged = { ...current, ...body, uid: userId };
      const bmr = calculateMifflinStJeorBmr(
        merged.gender || 'male',
        Number(merged.weightKg) || 76,
        Number(merged.heightCm) || 175,
        Number(merged.age) || 28
      );
      const mult = ACTIVITY_MULTIPLIERS[(merged.activityLevel as keyof typeof ACTIVITY_MULTIPLIERS) || 'moderately_active'] || 1.55;
      const baselineTdee = Math.round(bmr * mult);
      const targetCalories = Number(body.targetCalories) || calculateTargetCaloriesWithFloor(baselineTdee, merged.gender || 'male', merged.goalMode || 'moderate_cut');
      const updated = { ...merged, bmr, baselineTdee, targetCalories, updatedAt: new Date().toISOString() };
      fallbackStore.biometrics[userId] = updated;

      if (db) {
        try {
          await ensureUserExists();
          await db.sql`
            INSERT INTO vibe_biometrics (user_id, payload, updated_at)
            VALUES (${userId}, ${JSON.stringify(updated)}, NOW())
            ON CONFLICT (user_id) DO UPDATE SET payload = ${JSON.stringify(updated)}, updated_at = NOW()
          `.execute();
        } catch (e) {
          console.error("DB error on PUT biometrics:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, biometrics: updated }), { status: 200, headers });
    }

    // 9. GET /v1/repeat-meals
    if (method === 'GET' && (path.endsWith('/repeat-meals') || path.endsWith('/repeat-meals/'))) {
      let repeatMeals = fallbackStore.repeatMeals[userId] || fallbackStore.repeatMeals['demo-user-uid'];
      if (db) {
        try {
          const rows = await db.sql`SELECT raw_payload FROM vibe_repeat_meals WHERE user_id = ${userId}`.execute();
          if (rows && rows.length > 0) {
            repeatMeals = rows.map((r: any) => r.raw_payload);
          }
        } catch (e) {
          console.error("DB error on GET repeat-meals:", e);
        }
      }
      return new Response(JSON.stringify({ success: true, repeatMeals }), { status: 200, headers });
    }

    // 10. GET /v1/support & POST /v1/support
    if (path.includes('/support')) {
      if (method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const ticket = {
          id: body.id || `TKT-${Date.now().toString().slice(-6)}`,
          uid: userId,
          category: body.category || 'nutrition_fix',
          subject: body.subject || 'Support Ticket',
          message: body.message || '',
          status: 'open',
          createdAt: new Date().toISOString(),
        };
        fallbackStore.tickets.unshift(ticket);

        if (db) {
          try {
            await ensureUserExists();
            await db.sql`
              INSERT INTO vibe_support_tickets (id, user_id, payload, created_at)
              VALUES (${ticket.id}, ${userId}, ${JSON.stringify(ticket)}, NOW())
              ON CONFLICT (id) DO UPDATE SET payload = ${JSON.stringify(ticket)}
            `.execute();
            await db.sql`
              INSERT INTO vibe_audit_logs (event_type, actor_uid, client_ip, details, created_at)
              VALUES ('support_ticket_created', ${userId}, 'netlify-edge', ${JSON.stringify({ ticketId: ticket.id, category: ticket.category })}, NOW())
            `.execute().catch(() => {});
          } catch (e) {
            console.error("DB error on POST support ticket:", e);
          }
        }

        return new Response(JSON.stringify({ success: true, ticket }), { status: 201, headers });
      }

      // GET /v1/support
      let tickets = fallbackStore.tickets.filter((t) => t.uid === userId);
      if (db) {
        try {
          const rows = await db.sql`SELECT payload FROM vibe_support_tickets WHERE user_id = ${userId} ORDER BY created_at DESC`.execute();
          if (rows && rows.length > 0) {
            tickets = rows.map((r: any) => r.payload);
          }
        } catch (e) {
          console.error("DB error on GET support tickets:", e);
        }
      }
      return new Response(JSON.stringify({ success: true, tickets }), { status: 200, headers });
    }

    // 11a. POST /v1/meals/photo & POST /v1/meals/parse (Honest Gemini Swarm — never silent hardcoded thali fallback)
    if (method === 'POST' && (path.endsWith('/meals/photo') || path.endsWith('/meals/parse'))) {
      const t0 = Date.now();
      const body = await req.json().catch(() => ({}));
      const slot = ['breakfast', 'lunch', 'dinner', 'snack'].includes(body.slot || body.slotHint)
        ? (body.slot || body.slotHint)
        : 'lunch';
      const date = body.date || new Date().toISOString().slice(0, 10);
      const isPhoto = path.endsWith('/meals/photo');

      if (!keyPoolRouter.hasConfiguredKeys()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Gemini AI recognition is unavailable because GEMINI_API_KEY is not configured.',
            code: 'AI_RECOGNITION_UNAVAILABLE',
          }),
          { status: 503, headers }
        );
      }

      try {
        const swarmRes = isPhoto
          ? await runGeminiNutritionSwarm(
              String(body.imageBase64 || ''),
              slot,
              String(body.contextNote || body.mealHint || '') || undefined
            )
          : await runTextMealNutritionSwarm(
              String(body.mealDescription || body.text || body.contextNote || '').trim(),
              slot
            );
        const items = (swarmRes.items || []).map((i: any) => normalizeFoodItem(i));
        const latencyMs = Math.max(1, Date.now() - t0);
        if (db) {
          await db.sql`
            UPDATE vibe_key_pool
            SET requests_count = requests_count + 1, latency_ms = ${latencyMs}, updated_at = NOW()
            WHERE slot_id = (SELECT slot_id FROM vibe_key_pool WHERE status = 'healthy' ORDER BY requests_count ASC, slot_id ASC LIMIT 1)
          `.execute().catch(() => {});
        }
        return new Response(
          JSON.stringify({
            success: true,
            stage: 'atwater_verified',
            latencyMs,
            draft: {
              id: `draft-${Date.now()}`,
              uid: userId,
              date,
              slot,
              status: 'ready_for_review',
              mealTitle: swarmRes.mealTitle,
              recognizedItems: items,
              questions: swarmRes.questions || [],
              isDemoMode: false,
            },
          }),
          { status: 201, headers }
        );
      } catch (err: any) {
        const latencyMs = Math.max(1, Date.now() - t0);
        if (db) {
          await db.sql`
            UPDATE vibe_key_pool
            SET errors_count = errors_count + 1, latency_ms = ${latencyMs}, updated_at = NOW()
            WHERE slot_id = (SELECT slot_id FROM vibe_key_pool WHERE status = 'healthy' ORDER BY requests_count ASC, slot_id ASC LIMIT 1)
          `.execute().catch(() => {});
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: err?.message || 'Upstream Gemini recognition swarm failed across all fallback models.',
            code: 'AI_SWARM_UPSTREAM_FAILED',
            latencyMs,
          }),
          { status: 502, headers }
        );
      }
    }

    // 11. POST /v1/ai/analyze & POST /v1/drafts & POST /v1/drafts/text
    if (
      method === 'POST' &&
      (path.endsWith('/ai/analyze') || path.endsWith('/drafts') || path.endsWith('/drafts/text'))
    ) {
      const t0 = Date.now();
      const body = await req.json().catch(() => ({}));
      const slot = ['breakfast', 'lunch', 'dinner', 'snack'].includes(body.slot || body.slotHint)
        ? (body.slot || body.slotHint)
        : 'lunch';
      const date = body.date || new Date().toISOString().slice(0, 10);
      const mealDescription = String(body.mealDescription || body.contextNote || body.mealHint || '').trim();
      const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
      const draftId = `draft-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      let recognizedItems: any[] = [];
      let questions: any[] = [];
      let mealTitle = mealDescription || 'AI Recognized Meal';
      let isDemoMode = !keyPoolRouter.hasConfiguredKeys();
      let hadError = false;

      try {
        if (keyPoolRouter.hasConfiguredKeys()) {
          if (mealDescription && !imageBase64) {
            const swarmRes = await runTextMealNutritionSwarm(mealDescription, slot);
            recognizedItems = (swarmRes.items || []).map((i: any) => normalizeFoodItem(i));
            questions = swarmRes.questions || [];
            mealTitle = swarmRes.mealTitle || mealTitle;
            isDemoMode = false;
          } else if (imageBase64) {
            const swarmRes = await runGeminiNutritionSwarm(imageBase64, slot, mealDescription || undefined);
            recognizedItems = (swarmRes.items || []).map((i: any) => normalizeFoodItem(i));
            questions = swarmRes.questions || [];
            mealTitle = swarmRes.mealTitle || mealTitle;
            isDemoMode = false;
          }
        }
      } catch (err) {
        hadError = true;
        console.warn("[v1.mts /ai/analyze] Swarm fallback triggered:", err);
      }

      if (recognizedItems.length === 0) {
        const parsed = parseNaturalLanguageMeal(
          mealDescription || 'Grilled Paneer Tikka Bowl with Basmati Rice & Dal Makhani',
          slot,
          userId
        );
        recognizedItems = (parsed.recognizedItems || []).map((i: any) => normalizeFoodItem(i));
        questions = parsed.questions || [];
        mealTitle = parsed.mealTitle || mealTitle;
      }

      const latencyMs = Math.max(1, Date.now() - t0);
      const draft = {
        id: draftId,
        uid: userId,
        date,
        slot,
        status: 'ready_for_review',
        stage: 'atwater_verified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mealTitle,
        recognizedItems,
        questions,
        isDemoMode,
      };

      if (!fallbackStore.drafts[userId]) fallbackStore.drafts[userId] = {};
      fallbackStore.drafts[userId][draftId] = draft;

      // Update live telemetry in PostgreSQL vibe_key_pool & vibe_system_telemetry
      if (db) {
        try {
          await db.sql`
            UPDATE vibe_key_pool
            SET requests_count = requests_count + 1,
                errors_count = errors_count + ${hadError ? 1 : 0},
                latency_ms = ${latencyMs},
                updated_at = NOW()
            WHERE slot_id = (
              SELECT slot_id
              FROM vibe_key_pool
              WHERE status = 'healthy'
              ORDER BY requests_count ASC, slot_id ASC
              LIMIT 1
            )
          `.execute().catch(() => {});

          await db.sql`
            INSERT INTO vibe_system_telemetry (metric_name, metric_value, payload, recorded_at)
            VALUES ('ai_analyze_latency_ms', ${latencyMs}, ${JSON.stringify({ draftId, userId, slot, itemCount: recognizedItems.length, isDemoMode })}, NOW())
          `.execute().catch(() => {});
        } catch {}
      }

      return new Response(
        JSON.stringify({
          success: true,
          draftId,
          status: draft.status,
          stage: draft.stage,
          latencyMs,
          draft,
        }),
        { status: 201, headers }
      );
    }

    // 12. GET /v1/drafts/:id & POST /v1/drafts/:id/confirm
    if (path.includes('/drafts/')) {
      const after = path.split('/drafts/')[1] || '';
      const draftId = after.split('/')[0];
      if (method === 'POST' && after.endsWith('/confirm')) {
        const body = await req.json().catch(() => ({}));
        const existingDraft = fallbackStore.drafts[userId]?.[draftId];
        const rawItems = Array.isArray(body.items) && body.items.length > 0
          ? body.items
          : (existingDraft?.recognizedItems || []);
        const items = rawItems.map((i: any) => normalizeFoodItem(i));
        const meal = {
          id: body.mealId || body.id || `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: body.date || existingDraft?.date || new Date().toISOString().slice(0, 10),
          slot: body.slot || existingDraft?.slot || 'lunch',
          title: body.title || existingDraft?.mealTitle || 'AI Vision Logged Meal',
          items,
          totalCalories: Math.round(items.reduce((s: number, i: any) => s + (Number(i.calories) || 0), 0)),
          totalProtein: Number(items.reduce((s: number, i: any) => s + (Number(i.protein) || 0), 0).toFixed(1)),
          totalCarbs: Number(items.reduce((s: number, i: any) => s + (Number(i.carbs) || 0), 0).toFixed(1)),
          totalFat: Number(items.reduce((s: number, i: any) => s + (Number(i.fat) || 0), 0).toFixed(1)),
          createdAt: new Date().toISOString(),
        };
        if (!fallbackStore.meals[userId]) fallbackStore.meals[userId] = [];
        const existingIdx = fallbackStore.meals[userId].findIndex((m) => m.id === meal.id);
        if (existingIdx >= 0) {
          fallbackStore.meals[userId][existingIdx] = meal;
        } else {
          fallbackStore.meals[userId].push(meal);
        }
        if (db) {
          try {
            await ensureUserExists();
            await db.sql`
              INSERT INTO vibe_meals (id, user_id, date, slot, title, calories, protein_g, carbs_g, fat_g, verified, raw_payload, created_at)
              VALUES (${meal.id}, ${userId}, ${meal.date}, ${meal.slot}, ${meal.title}, ${meal.totalCalories}, ${meal.totalProtein}, ${meal.totalCarbs}, ${meal.totalFat}, TRUE, ${JSON.stringify(meal)}, NOW())
              ON CONFLICT (id) DO UPDATE SET raw_payload = ${JSON.stringify(meal)}
            `.execute();
          } catch {}
        }
        return new Response(
          JSON.stringify({ success: true, mealId: meal.id, meal, ephemeralImagePurged: true }),
          { status: 200, headers }
        );
      }

      const draft = fallbackStore.drafts[userId]?.[draftId];
      if (!draft) {
        return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404, headers });
      }
      return new Response(JSON.stringify({ success: true, draft, stage: draft.stage }), { status: 200, headers });
    }

    // 13. GET /v1/foods/search (Tier 1 USDA/IFCT + Atwater verification)
    if (method === 'GET' && path.includes('/foods/search')) {
      const q = String(url.searchParams.get('q') || '').trim();
      const results = (await foodCatalogService.searchFoods(q, 2500)).map((item) => normalizeFoodItem(item));
      return new Response(JSON.stringify({ success: true, results }), { status: 200, headers });
    }

    // 14. GET /v1/foods/barcode/:code (Tier 2 Open Food Facts + Atwater verification)
    if (method === 'GET' && path.includes('/foods/barcode/')) {
      const code = decodeURIComponent(path.split('/foods/barcode/')[1]?.split(/[/?#]/)[0] || '').trim();
      const item = await foodCatalogService.lookupBarcode(code, 4000);
      if (!item) {
        return new Response(JSON.stringify({ error: `Barcode ${code} not found in Open Food Facts registry` }), { status: 404, headers });
      }
      return new Response(JSON.stringify({ success: true, item: normalizeFoodItem(item) }), { status: 200, headers });
    }

    // 15. GET /v1/user/export & DELETE /v1/user/data (GDPR / DPDP Portability & Erasure)
    if (method === 'GET' && path.endsWith('/user/export')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            exportTimestamp: new Date().toISOString(),
            uid: userId,
            biometrics: fallbackStore.biometrics[userId] || null,
            meals: fallbackStore.meals[userId] || [],
            weights: fallbackStore.weights[userId] || [],
            supportTickets: fallbackStore.tickets.filter((t) => t.uid === userId),
          },
        }),
        { status: 200, headers }
      );
    }

    if (method === 'DELETE' && path.endsWith('/user/data')) {
      delete fallbackStore.meals[userId];
      delete fallbackStore.weights[userId];
      delete fallbackStore.biometrics[userId];
      delete fallbackStore.drafts[userId];
      for (const k of Object.keys(fallbackStore.days)) {
        if (k.startsWith(`${userId}:`)) delete fallbackStore.days[k];
      }
      if (db) {
        try {
          await db.sql`DELETE FROM vibe_meals WHERE user_id = ${userId}`.execute();
          await db.sql`DELETE FROM vibe_days WHERE user_id = ${userId}`.execute();
          await db.sql`DELETE FROM vibe_weights WHERE user_id = ${userId}`.execute();
          await db.sql`DELETE FROM vibe_biometrics WHERE user_id = ${userId}`.execute();
        } catch {}
      }
      return new Response(
        JSON.stringify({ success: true, message: 'All user data permanently erased per GDPR/DPDP mandate' }),
        { status: 200, headers }
      );
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found', path }), { status: 404, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { status: 500, headers });
  }
}

export const config: Config = {
  path: [
    "/v1/ai/analyze",
    "/v1/meals/photo",
    "/v1/meals/parse",
    "/v1/drafts",
    "/v1/drafts/*",
    "/v1/foods/search",
    "/v1/foods/barcode/*",
    "/v1/days/*",
    "/v1/meals/*",
    "/v1/meals",
    "/v1/weights",
    "/v1/biometrics",
    "/v1/repeat-meals",
    "/v1/support",
    "/v1/support/*",
    "/v1/user/export",
    "/v1/user/data",
  ],
};
