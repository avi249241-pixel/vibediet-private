# 🛡️ Admin Governance Console

#feature #ui

Linked: [[00-Home]] | [[Architecture]] | [[Key-Pool-Router]] | [[Gemini-Recognition-Swarm]] | [[AI-Meal-Scan]] | [[Profile-and-Support]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/components/AdminDashboardScreen.tsx`
- `VibeDiet/netlify/functions/admin.mts`
- `VibeDiet/src/services/auditLogger.ts`
- `VibeDiet/src/middleware/security.ts`

## Core Capabilities
- **Air-Gapped Code Splitting:** Lazy-loaded on `/admin` or `#admin` only; unauthenticated visitors see the strict login gate with zero leaked telemetry.
- **Live Key Pool & AI Telemetry:** Displays real `Reqs`, `Errors`, and `Last Latency` from [[Key-Pool-Router]], `vibe_key_pool`, and `vibe_system_telemetry` whenever [[AI-Meal-Scan]] executes `POST /v1/ai/analyze` or admins click Ping Swarm (`POST /v1/admin/ping`).
- **PostgreSQL Table Drill-Down:** Inspects all 12 allowed `vibe_*` tables via `GET /v1/admin/tables/:tableName` ([[PostgreSQL-Schema]]).
- **Support Inbox & Audit Governance:** Lists open tickets created via [[Profile-and-Support]], supports 1-click **Mark Resolved** (`POST /v1/admin/support/:id/resolve`), and records resolution events in `vibe_audit_logs`.

## API Endpoints & Database Tables
- **API ([[Serverless-API]]):** `GET /v1/admin/overview`, `POST /v1/admin/keys`, `DELETE /v1/admin/keys/:id`, `POST /v1/admin/ping`, `POST /v1/admin/sweeper`, `GET /v1/admin/tables/:tableName`, `POST /v1/admin/support/:id/resolve`.
- **Database ([[PostgreSQL-Schema]]):** `vibe_key_pool`, `vibe_system_telemetry`, `vibe_support_tickets`, `vibe_audit_logs`, plus all tenant tables.
