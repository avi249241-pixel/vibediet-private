import type { Config, Context } from "@netlify/functions";

// In-memory fallback cache when Netlify Database is initializing or offline
const fallbackStore: {
  meals: Record<string, any[]>;
  days: Record<string, any>;
  weights: Record<string, any[]>;
  biometrics: Record<string, any>;
  repeatMeals: Record<string, any[]>;
  tickets: any[];
} = {
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
  days: {
    'demo-user-uid': {
      waterMl: 1750,
      calorieTarget: 2245,
    },
  },
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

      let dayMeals: any[] = [];
      let waterMl = 1750;

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
            waterMl = dayRows[0].payload?.waterMl ?? 1750;
          } else {
            waterMl = fallbackStore.days[userId]?.waterMl ?? 1750;
          }
        } catch (e) {
          dayMeals = (fallbackStore.meals[userId] || []).filter((m) => m.date === date);
          waterMl = fallbackStore.days[userId]?.waterMl ?? 1750;
        }
      } else {
        dayMeals = (fallbackStore.meals[userId] || []).filter((m) => m.date === date);
        waterMl = fallbackStore.days[userId]?.waterMl ?? 1750;
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
      const body = await req.json().catch(() => ({}));
      const deltaMl = Number(body.deltaMl) || 250;

      let currentWater = fallbackStore.days[userId]?.waterMl ?? 1750;
      if (db) {
        try {
          const dayRows = await db.sql`SELECT payload FROM vibe_days WHERE user_id = ${userId} AND date = ${date}`.execute();
          if (dayRows && dayRows.length > 0) {
            currentWater = dayRows[0].payload?.waterMl ?? currentWater;
          }
        } catch {}
      }

      const nextWater = Math.max(0, currentWater + deltaMl);
      fallbackStore.days[userId] = { waterMl: nextWater, calorieTarget: 2245 };

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
      const items = body.items || [];
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

    // 6. POST /v1/weights
    if (method === 'POST' && (path.endsWith('/weights') || path.endsWith('/weights/'))) {
      const body = await req.json().catch(() => ({}));
      const weightVal = Number(body.weightKg || body.weight || 76.0);
      const entry = {
        id: body.id || `w-${Date.now()}`,
        date: body.date || new Date().toISOString().slice(0, 10),
        weightKg: weightVal,
        trendKg: Number(body.trendKg || weightVal),
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

    // 8. PUT /v1/biometrics
    if ((method === 'PUT' || method === 'POST') && (path.endsWith('/biometrics') || path.endsWith('/biometrics/'))) {
      const body = await req.json().catch(() => ({}));
      const current = fallbackStore.biometrics[userId] || fallbackStore.biometrics['demo-user-uid'];
      const updated = { ...current, ...body, uid: userId, updatedAt: new Date().toISOString() };
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

    return new Response(JSON.stringify({ error: 'Endpoint not found', path }), { status: 404, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { status: 500, headers });
  }
}

export const config: Config = {
  path: [
    "/v1/days/*",
    "/v1/meals/*",
    "/v1/meals",
    "/v1/weights",
    "/v1/biometrics",
    "/v1/repeat-meals",
    "/v1/support",
    "/v1/support/*",
  ],
};
