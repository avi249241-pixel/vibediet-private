# 🌐 Serverless & Express API Map

#backend

Linked: [[00-Home]] | [[Architecture]] | [[Code-Graph]] | [[DietContext]] | [[PostgreSQL-Schema]] | [[Gemini-Recognition-Swarm]] | [[Key-Pool-Router]] | [[Atwater-Verifier]] | [[Adaptive-TDEE-EWMA]] | [[Today-Dashboard]] | [[AI-Meal-Scan]] | [[Food-Search-Catalog]] | [[Metabolism-Coach]] | [[Profile-and-Support]] | [[Admin-Console]]

## Source Files
- `VibeDiet/netlify/functions/v1.mts` (Production Netlify Consumer Serverless Router)
- `VibeDiet/netlify/functions/admin.mts` (Production Netlify Admin Serverless Router)
- `VibeDiet/src/routes/v1.ts` (Local / Express Parity Router)
- `VibeDiet/server.ts` (Express Entrypoint, Helmet CSP, CORS, Rate Limiters)

## Consumer Routes (`/v1/*` — `v1.mts` & `src/routes/v1.ts`)
| Method & Path | Connected Feature / Engine | Persisted Tables ([[PostgreSQL-Schema]]) |
| :--- | :--- | :--- |
| `POST /v1/ai/analyze` | [[AI-Meal-Scan]] → [[Key-Pool-Router]] → [[Gemini-Recognition-Swarm]] → [[Atwater-Verifier]] | `vibe_key_pool`, `vibe_system_telemetry` |
| `POST /v1/drafts`, `POST /v1/drafts/text`, `GET /v1/drafts/:id`, `POST /v1/drafts/:id/confirm` | [[AI-Meal-Scan]] → [[DietContext]] | `vibe_meals`, `vibe_day_summaries` |
| `GET /v1/foods/search`, `GET /v1/foods/barcode/:code` | [[Food-Search-Catalog]] → [[Atwater-Verifier]] | Read-through USDA / Open Food Facts |
| `GET /v1/days/:date`, `POST /v1/days/:date/water` | [[Today-Dashboard]] → [[DietContext]] | `vibe_days`, `vibe_meals`, `vibe_day_summaries` |
| `POST /v1/meals/manual`, `DELETE /v1/meals/:id`, `GET /v1/repeat-meals` | [[Today-Dashboard]] → [[DietContext]] | `vibe_meals`, `vibe_day_summaries`, `vibe_repeat_meals` |
| `GET /v1/weights`, `POST /v1/weights` | [[Metabolism-Coach]] → [[Adaptive-TDEE-EWMA]] | `vibe_weights` |
| `GET /v1/biometrics`, `PUT /v1/biometrics` | [[Metabolism-Coach]] & [[Profile-and-Support]] → [[Adaptive-TDEE-EWMA]] | `vibe_biometrics` |
| `GET /v1/support`, `POST /v1/support` | [[Profile-and-Support]] → [[Admin-Console]] | `vibe_support_tickets`, `vibe_audit_logs` |
| `GET /v1/user/export`, `DELETE /v1/user/data` | [[Profile-and-Support]] (GDPR/DPDP) | All tenant tables |

## Admin Governance Routes (`/v1/admin/*` — `admin.mts` & `src/routes/v1.ts`)
| Method & Path | Connected Feature / Engine | Persisted Tables ([[PostgreSQL-Schema]]) |
| :--- | :--- | :--- |
| `GET /v1/admin/overview` | [[Admin-Console]] → [[Key-Pool-Router]] | `vibe_key_pool`, `vibe_system_telemetry`, `vibe_support_tickets`, `vibe_audit_logs` |
| `POST /v1/admin/keys`, `DELETE /v1/admin/keys/:id`, `POST /v1/admin/ping` | [[Admin-Console]] → [[Key-Pool-Router]] | `vibe_key_pool` |
| `GET /v1/admin/tables/:tableName` | [[Admin-Console]] DB Inspector | All 12 `vibe_*` tables |
| `POST /v1/admin/support/:id/resolve` | [[Admin-Console]] Support Inbox | `vibe_support_tickets`, `vibe_audit_logs` |
| `POST /v1/admin/sweeper` | [[Admin-Console]] Draft Sweeper | Drafts queue |
