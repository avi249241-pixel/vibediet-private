-- Migration 004: Flexible payload support on vibe_weights
ALTER TABLE vibe_weights ADD COLUMN IF NOT EXISTS payload JSONB;
