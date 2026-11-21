import { Hono } from 'hono';
import type { Bindings } from '../env.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export const syncRouter = new Hono<{ Bindings: Bindings }>();

// Helper to extract token and authenticate with Supabase
async function authenticateUser(c: any): Promise<{ user: any; error?: string }> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized: Missing or invalid Authorization header' };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { user: null, error: 'Unauthorized: Missing Bearer token' };
  }

  const supabase = getSupabaseAdmin(c.env);
  if (!supabase) {
    return { user: null, error: 'Unauthorized: Supabase authentication unavailable' };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: 'Unauthorized: Invalid or expired token' };
  }

  return { user: data.user };
}

// POST /v1/sync/push
syncRouter.post('/push', async (c) => {
  const auth = await authenticateUser(c);
  if (auth.error || !auth.user) {
    return c.json({ error: auth.error || 'Unauthorized' }, 401);
  }

  const user = auth.user;
  const supabase = getSupabaseAdmin(c.env);
  if (!supabase) {
    return c.json({ error: 'Supabase client unavailable' }, 503);
  }

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const meals = Array.isArray(body?.vibe_meal_sync)
    ? body.vibe_meal_sync
    : Array.isArray(body?.meals)
    ? body.meals
    : [];

  const weights = Array.isArray(body?.vibe_weight_sync)
    ? body.vibe_weight_sync
    : Array.isArray(body?.weights)
    ? body.weights
    : [];

  const syncedCounts = {
    meals: 0,
    weights: 0,
  };

  const syncedAt = new Date().toISOString();

  // Upsert meal delta records
  if (meals.length > 0) {
    const records = meals.map((m: any) => ({
      ...m,
      user_id: user.id,
      synced_at: syncedAt,
    }));
    const { error: mealError } = await supabase
      .from('vibe_meal_sync')
      .upsert(records, { onConflict: 'id' });

    if (!mealError) {
      syncedCounts.meals = meals.length;
    } else {
      console.warn('[SyncPush] Meal upsert error:', mealError);
    }
  }

  // Upsert weight delta records
  if (weights.length > 0) {
    const records = weights.map((w: any) => ({
      ...w,
      user_id: user.id,
      synced_at: syncedAt,
    }));
    const { error: weightError } = await supabase
      .from('vibe_weight_sync')
      .upsert(records, { onConflict: 'id' });

    if (!weightError) {
      syncedCounts.weights = weights.length;
    } else {
      console.warn('[SyncPush] Weight upsert error:', weightError);
    }
  }

  return c.json({
    success: true,
    clientMutationId: body?.clientMutationId,
    syncedAt,
    syncedCounts,
  }, 200);
});

// GET /v1/sync/pull
syncRouter.get('/pull', async (c) => {
  const auth = await authenticateUser(c);
  if (auth.error || !auth.user) {
    return c.json({ error: auth.error || 'Unauthorized' }, 401);
  }

  const user = auth.user;
  const supabase = getSupabaseAdmin(c.env);
  if (!supabase) {
    return c.json({ error: 'Supabase client unavailable' }, 503);
  }

  const since = c.req.query('since');
  const pulledAt = new Date().toISOString();

  let mealQuery = supabase
    .from('vibe_meal_sync')
    .select('*')
    .eq('user_id', user.id);

  let weightQuery = supabase
    .from('vibe_weight_sync')
    .select('*')
    .eq('user_id', user.id);

  if (since && typeof since === 'string' && since.trim()) {
    mealQuery = mealQuery.gt('synced_at', since.trim());
    weightQuery = weightQuery.gt('synced_at', since.trim());
  }

  const [mealRes, weightRes] = await Promise.all([mealQuery, weightQuery]);

  const meals = mealRes.data || [];
  const weights = weightRes.data || [];

  return c.json({
    success: true,
    pulledAt,
    meals,
    weights,
  }, 200);
});
