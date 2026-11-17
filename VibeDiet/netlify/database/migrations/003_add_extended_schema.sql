-- =========================================================================
-- VibeDiet Extended Schema: Biometrics, Calibrations, Support Tickets & Drafts
-- Migration: 003_add_extended_schema.sql
-- =========================================================================

-- 1. User Biometrics & Metabolic Calibration
CREATE TABLE IF NOT EXISTS vibe_biometrics (
    user_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI Vision Portion Calibrations Memory
CREATE TABLE IF NOT EXISTS vibe_portion_calibrations (
    user_id TEXT NOT NULL,
    food_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, food_key)
);

-- 3. Customer Support Desk & Engineering Triage Tickets
CREATE TABLE IF NOT EXISTS vibe_support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Active Ephemeral Photo / Text Drafts
CREATE TABLE IF NOT EXISTS vibe_drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vibe_drafts_user ON vibe_drafts(user_id);

-- 5. Day Summaries (payload compatibility)
CREATE TABLE IF NOT EXISTS vibe_days (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- Seed Demo Biometrics
INSERT INTO vibe_biometrics (user_id, payload)
VALUES (
  'demo-user-uid',
  '{"uid":"demo-user-uid","email":"avi-demo@vibediet.app","displayName":"Avi Demo","age":28,"gender":"male","heightCm":178,"weightKg":76.0,"activityLevel":"moderately_active","goalMode":"lean_mass","dietaryPreference":"balanced","targetCalories":2245,"macroSplit":{"proteinPct":30,"carbPct":45,"fatPct":25}}'::jsonb
) ON CONFLICT (user_id) DO NOTHING;

-- Seed Sample Support Ticket
INSERT INTO vibe_support_tickets (id, user_id, payload)
VALUES (
  'TKT-INIT-001',
  'demo-user-uid',
  '{"id":"TKT-INIT-001","uid":"demo-user-uid","category":"nutrition_fix","subject":"Database Auto-Sync Initialized","message":"System database successfully connected with multi-tenant partition schema.","status":"open","createdAt":"2026-11-17T00:00:00.000Z"}'::jsonb
) ON CONFLICT (id) DO NOTHING;
