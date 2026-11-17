-- =========================================================================
-- VibeDiet Initial Seed Data (Admin Account, Demo User & 8-Key Swarm)
-- =========================================================================

-- Seed Master Admin & Demo User
INSERT INTO vibe_users (id, email, is_admin, display_name)
VALUES 
  ('admin-local-uid', 'avi-admin@vibediet.app', TRUE, 'Avi (Lead Architect)'),
  ('demo-user-uid', 'avi-demo@vibediet.app', FALSE, 'Avi Demo')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Seed 8-Slot Masked Gemini Key Swarm
INSERT INTO vibe_key_pool (slot_id, masked_key, key_hash, status, latency_ms, requests_count, errors_count)
VALUES
  ('key-slot-1', 'AQ.Ab...rP9g', 'hash_slot_1', 'healthy', 312, 14, 0),
  ('key-slot-2', 'AQ.Ab...kiPg', 'hash_slot_2', 'healthy', 285, 12, 0),
  ('key-slot-3', 'AQ.Ab...q8ow', 'hash_slot_3', 'healthy', 340, 11, 0),
  ('key-slot-4', 'AQ.Ab...DhAg', 'hash_slot_4', 'healthy', 298, 9, 0),
  ('key-slot-5', 'AQ.Ab...dZwQ', 'hash_slot_5', 'healthy', 320, 8, 0),
  ('key-slot-6', 'AQ.Ab...hvOg', 'hash_slot_6', 'healthy', 310, 7, 0),
  ('key-slot-7', 'AQ.Ab...pLYg', 'hash_slot_7', 'healthy', 305, 5, 0),
  ('key-slot-8', 'AQ.Ab...W8hg', 'hash_slot_8', 'healthy', 290, 4, 0)
ON CONFLICT (slot_id) DO UPDATE SET status = EXCLUDED.status;

-- Seed Initial System Telemetry Baseline
INSERT INTO vibe_system_telemetry (rss_memory_mb, active_keys_count, queue_depth, persistence_mode)
VALUES (39.40, 8, 0, 'netlify-managed-postgres');

-- Seed Initial Audit Event
INSERT INTO vibe_audit_logs (event_type, actor_uid, client_ip, details)
VALUES ('database_initialized', 'system', '127.0.0.1', '{"schema_version": "2.0.0", "partitioning": "user_id", "status": "active"}'::jsonb);
