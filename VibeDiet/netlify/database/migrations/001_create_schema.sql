-- =========================================================================
-- VibeDiet Production Relational Database Schema
-- Multi-Tenant Partitioning, Atwater Verification & Zero-Leakage Admin Pool
-- =========================================================================

-- 1. Users & Tenant Accounts
CREATE TABLE IF NOT EXISTS vibe_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Multi-Key Gemini Vision Swarm (Admin Cockpit)
CREATE TABLE IF NOT EXISTS vibe_key_pool (
    slot_id TEXT PRIMARY KEY,
    masked_key TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    provider TEXT DEFAULT 'google_gemini',
    status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'cooldown', 'revoked')),
    latency_ms INTEGER DEFAULT 0,
    requests_count INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. High-Frequency Real-Time Telemetry Log
CREATE TABLE IF NOT EXISTS vibe_system_telemetry (
    id BIGSERIAL PRIMARY KEY,
    rss_memory_mb NUMERIC(6, 2) NOT NULL,
    active_keys_count INTEGER DEFAULT 0,
    queue_depth INTEGER DEFAULT 0,
    persistence_mode TEXT DEFAULT 'netlify-postgres',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Immutable Security Audit Trail
CREATE TABLE IF NOT EXISTS vibe_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor_uid TEXT NOT NULL,
    client_ip TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Verified Meals Table (Atwater 4-4-9-7 Invariants)
CREATE TABLE IF NOT EXISTS vibe_meals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vibe_users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_vibe_meals_user_date ON vibe_meals(user_id, date);

-- 6. Daily Nutrition & Hydration Aggregates
CREATE TABLE IF NOT EXISTS vibe_day_summaries (
    user_id TEXT NOT NULL REFERENCES vibe_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calorie_target NUMERIC(7, 2) DEFAULT 2245,
    water_ml INTEGER DEFAULT 0,
    raw_summary JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- 7. EWMA Adaptive Metabolism Weight Records (alpha=0.12)
CREATE TABLE IF NOT EXISTS vibe_weights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vibe_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5, 2) NOT NULL,
    smoothed_trend_kg NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vibe_weights_user_date ON vibe_weights(user_id, date);

-- 8. One-Tap Repeat Meals Library
CREATE TABLE IF NOT EXISTS vibe_repeat_meals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES vibe_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vibe_repeat_meals_user ON vibe_repeat_meals(user_id);
