# 🔑 Key Pool Router

#ai-model #backend

Linked: [[00-Home]] | [[Architecture]] | [[Gemini-Recognition-Swarm]] | [[Admin-Console]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/services/keyPoolRouter.ts`
- `VibeDiet/src/server/ai/keyPoolRouter.ts`
- `VibeDiet/netlify/functions/admin.mts`

## Routing & Resilience Mechanics
- **8-Slot Round-Robin Pool:** Distributes `@google/genai` inference calls across configured API key slots (`vibe_key_pool`), preventing single-key quota exhaustion during peak traffic.
- **60-Second HTTP 429 Cooldowns:** Automatically moves rate-limited slots into `cooldown` state for 60 seconds and immediately retries on the next healthy slot via `executeWithModelFallback()`.
- **Model Cascade Integration:** Powers the `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.0-flash` failover inside [[Gemini-Recognition-Swarm]].
- **Live Telemetry Persistence:** Increments `requests_count`, `errors_count`, and `latency_ms` in `vibe_key_pool` ([[PostgreSQL-Schema]]) and streams real-time slot health to [[Admin-Console]] (`GET /v1/admin/overview`).
- **Secret Masking:** All keys are masked via `maskKey()` before logging to `vibe_audit_logs` or rendering in [[Admin-Console]].
