-- =========================================================================
-- VibeDiet Complete Supabase Production Schema & RLS Policies
-- Project Ref: bxufxutwupuldzwyzzbv
-- Authoritative: VibeDiet Edge Worker + Hybrid Local-First Delta Sync
-- =========================================================================

-- Enable pgcrypto for UUID/hash functions if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------------
-- 1. Users Table (Maps to Supabase Auth UID)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    is_admin BOOLEAN DEFAULT FALSE,
    display_name TEXT,
    pro_since TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vibe_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.vibe_users;
CREATE POLICY "Users can view own profile"
    ON public.vibe_users FOR SELECT
    USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.vibe_users;
CREATE POLICY "Users can update own profile"
    ON public.vibe_users FOR UPDATE
    USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.vibe_users;
CREATE POLICY "Users can insert own profile"
    ON public.vibe_users FOR INSERT
    WITH CHECK (auth.uid()::text = id);

-- -------------------------------------------------------------------------
-- 2. Cloud Delta Sync: Meals (vibe_meal_sync)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_meal_sync (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.vibe_users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    slot TEXT,
    name TEXT,
    calories NUMERIC(7, 2),
    protein_g NUMERIC(6, 2),
    carbs_g NUMERIC(6, 2),
    fat_g NUMERIC(6, 2),
    fiber_g NUMERIC(6, 2) DEFAULT 0,
    payload JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vibe_meal_sync_user_synced 
    ON public.vibe_meal_sync (user_id, synced_at);

ALTER TABLE public.vibe_meal_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own synced meals" ON public.vibe_meal_sync;
CREATE POLICY "Users can view own synced meals"
    ON public.vibe_meal_sync FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert/update own synced meals" ON public.vibe_meal_sync;
CREATE POLICY "Users can insert/update own synced meals"
    ON public.vibe_meal_sync FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- -------------------------------------------------------------------------
-- 3. Cloud Delta Sync: Weights (vibe_weight_sync)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_weight_sync (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.vibe_users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    weight_kg NUMERIC(5, 2),
    smoothed_weight_kg NUMERIC(5, 2),
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vibe_weight_sync_user_synced 
    ON public.vibe_weight_sync (user_id, synced_at);

ALTER TABLE public.vibe_weight_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own synced weights" ON public.vibe_weight_sync;
CREATE POLICY "Users can view own synced weights"
    ON public.vibe_weight_sync FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert/update own synced weights" ON public.vibe_weight_sync;
CREATE POLICY "Users can insert/update own synced weights"
    ON public.vibe_weight_sync FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- -------------------------------------------------------------------------
-- 4. Verified Meals (vibe_meals)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_meals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.vibe_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
    title TEXT NOT NULL,
    calories NUMERIC(7, 2) NOT NULL,
    protein_g NUMERIC(6, 2) NOT NULL,
    carbs_g NUMERIC(6, 2) NOT NULL,
    fat_g NUMERIC(6, 2) NOT NULL,
    fiber_g NUMERIC(6, 2) DEFAULT 0,
    verified BOOLEAN DEFAULT TRUE,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vibe_meals_user_date 
    ON public.vibe_meals(user_id, date);

ALTER TABLE public.vibe_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own meals" ON public.vibe_meals;
CREATE POLICY "Users can manage own meals"
    ON public.vibe_meals FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- -------------------------------------------------------------------------
-- 5. Daily Aggregates (vibe_day_summaries)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_day_summaries (
    user_id TEXT NOT NULL REFERENCES public.vibe_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calorie_target NUMERIC(7, 2) DEFAULT 2245,
    water_ml INTEGER DEFAULT 0,
    raw_summary JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

ALTER TABLE public.vibe_day_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own day summaries" ON public.vibe_day_summaries;
CREATE POLICY "Users can manage own day summaries"
    ON public.vibe_day_summaries FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- -------------------------------------------------------------------------
-- 6. User Biometrics & Drafts
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_biometrics (
    user_id TEXT PRIMARY KEY REFERENCES public.vibe_users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vibe_biometrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own biometrics" ON public.vibe_biometrics;
CREATE POLICY "Users can manage own biometrics"
    ON public.vibe_biometrics FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS public.vibe_drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.vibe_users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vibe_drafts_user ON public.vibe_drafts(user_id);
ALTER TABLE public.vibe_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own drafts" ON public.vibe_drafts;
CREATE POLICY "Users can manage own drafts"
    ON public.vibe_drafts FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- -------------------------------------------------------------------------
-- 7. Admin Cockpit & Telemetry
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_system_telemetry (
    id BIGSERIAL PRIMARY KEY,
    rss_memory_mb NUMERIC(6, 2) NOT NULL,
    active_keys_count INTEGER DEFAULT 0,
    queue_depth INTEGER DEFAULT 0,
    persistence_mode TEXT DEFAULT 'cloudflare-workers-supabase',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vibe_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor_uid TEXT NOT NULL,
    client_ip TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 8. Essential Supabase API Role Grants (anon, authenticated, service_role)
-- -------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

