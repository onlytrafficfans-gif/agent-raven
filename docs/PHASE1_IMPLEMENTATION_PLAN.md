# Agent.Raven Phase 1 implementation plan

Active phase: **Phase 1 — Foundation and Business Discovery**. Later phases are navigation-only, disabled, and labelled `Planned`.

## Vertical slice

1. Better Auth email/password session establishes an authenticated user.
2. Every app/server boundary resolves organization membership and role.
3. An owner/admin stores an Apollo API key encrypted with AES-256-GCM; the plaintext value is never returned.
4. The server checks the organization budget, calls Apollo organization search, normalizes an honest provider response, and records the search run and usage.
5. A user opens company detail and idempotently saves a company to the organization-scoped CRM.
6. PostgreSQL constraints prevent concurrent duplicates by Apollo organization ID or normalized domain.
7. Prospects remain searchable, filterable, sortable, editable, and auditable after reload/restart.

## Requirement map

| Requirement | Implementation | Verification |
|---|---|---|
| Authentication / server RBAC | `src/lib/auth.ts`, `src/lib/authorization.ts`, protected dashboard layout and route handlers | unit + route negative tests; Playwright redirect |
| Tenant-scoped database | `prisma/schema.prisma`, initial SQL migration | migration deploy and integration suite against PostgreSQL |
| Apollo connection | `src/lib/apollo.ts`, encrypted `IntegrationConnection`, `/api/integrations/apollo` | adapter contract tests; redacted live test when authorized |
| Search / history / budget | `/api/search`, search UI, `SearchQuery`, `SearchRun`, `IntegrationUsage` | validation, budget and error mapping tests; disconnected real-runtime browser state |
| Company detail / save | `/api/companies/[providerId]`, `/api/prospects` | normalization and idempotency tests; DB concurrency test |
| Prospect CRM | `/prospects`, `/api/prospects/[id]`, notes/tags/status audit | integration + Playwright reload/filter/edit |
| CSV fallback | `/api/import/csv`, CSV template and row-level validation | parser/normalization/dedup tests |
| Security / health / logging | AES-GCM encryption, redaction, correlation IDs, `/api/health`, audit records | secret scan, helper tests, endpoint inspection |
| Documentation | `docs/API.md`, `docs/OPERATIONS.md`, `.env.example`, `README.md` | manual inspection |

## Honest acceptance boundary

Live Apollo acceptance remains `BLOCKED` until the user supplies an authorized credential and explicitly permits credit-consuming calls within the configured budget. Local PostgreSQL migrations, authentication, CSV persistence, audited status updates, and reload durability have been exercised successfully.
