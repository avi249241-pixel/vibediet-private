# 👤 Profile, Data Portability & Support Desk

#feature #ui

Linked: [[00-Home]] | [[Architecture]] | [[DietContext]] | [[Admin-Console]] | [[Today-Dashboard]] | [[Serverless-API]] | [[PostgreSQL-Schema]]

## Source Files
- `VibeDiet/src/components/ProfileScreen.tsx`
- `VibeDiet/src/components/LegalModal.tsx`
- `VibeDiet/src/components/AuthModal.tsx`
- `VibeDiet/src/services/billingService.ts`

## Core Capabilities
- **Macro & Biometric Editor:** Allows direct tuning of daily calorie/protein/carb/fat targets (High-Protein, Balanced, Low-Carb presets) wired to `PUT /v1/biometrics`.
- **GDPR / DPDP Portability & Erasure:** 1-click JSON export (`GET /v1/user/export`), CSV export, and permanent user data wipe (`DELETE /v1/user/data`).
- **Support Desk → Admin Governance:** Submitting a ticket calls `submitSupportTicket()` → `POST /v1/support` → inserts into `vibe_support_tickets` and logs `support_ticket_created` in `vibe_audit_logs` for triage inside [[Admin-Console]].
- **Legal Shield:** Preserves the $0.00 aggregate liability cap and non-medical wellness disclaimers (`LEGAL.md`, `LegalModal.tsx`).

## State Hooks, API Endpoints & Database Tables
- **Context:** `useAuth()` & `useDiet()` ([[DietContext]]).
- **API ([[Serverless-API]]):** `PUT /v1/biometrics`, `POST /v1/support`, `GET /v1/support`, `GET /v1/user/export`, `DELETE /v1/user/data`, `POST /v1/billing/checkout`, `POST /v1/billing/simulate-webhook`.
- **Database ([[PostgreSQL-Schema]]):** `vibe_users`, `vibe_biometrics`, `vibe_support_tickets`, `vibe_audit_logs`.
