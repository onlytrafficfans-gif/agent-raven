# Phase 1 server interfaces

All application interfaces return JSON unless noted. Error responses use `{ error: { code, message, fields?, retryAfter? }, correlationId? }`. Except for `/api/health` and Better Auth session endpoints, routes require an authenticated session and a current organization membership. The organization is resolved server-side; clients cannot submit an organization ID.

| Method / path | Authorization | Input | Output | Error categories | Idempotency |
|---|---|---|---|---|---|
| `GET/POST /api/auth/[...all]` | Better Auth | Better Auth registration, email/password, reset-token, and session schemas | Better Auth session responses | framework-standard auth errors | Reset tokens are single-use; successful reset revokes existing sessions |
| `POST /api/account/workspace` | Authenticated account | optional `{ workspaceName }` | membership ID and created flag | validation, unauthorized, setup failure | A unique user-membership constraint and transaction make provisioning retry-safe |
| `POST /api/account/password-reset` | Public, rate-limited by Better Auth | `{ email }` | generic delivery message | validation, email provider not configured | Response does not disclose whether an account exists |
| `POST /api/integrations/apollo` | Owner or Admin | `{ apiKey: string }` | provider, state, lastTestedAt; never the key | validation, invalid credential, insufficient permission, rate limit, provider unavailable | Upsert by organization/provider |
| `DELETE /api/integrations/apollo` | Owner or Admin | none | disconnected state | unauthenticated, forbidden, internal | Repeated disconnect remains disconnected |
| `POST /api/search` | Owner, Admin, Analyst | industry/location/employee/revenue ranges, page, perPage | normalized companies, pagination, usage and correlation ID | validation, disconnected/invalid credential, permission, rate limit, budget block, outage | Read operation; every paid attempt records a run/usage outcome |
| `GET /api/companies/:providerId` | Owner, Admin, Analyst | provider organization ID in path | normalized company detail | disconnected, provider errors, not found | Explicit user action; Apollo may charge for complete detail according to current entitlement |
| `POST /api/prospects` | Owner, Admin, Analyst | provider identity, retrieved company fields, provenance | prospect plus `created` boolean | validation, identity conflict, unauthorized | Idempotent by organization + provider ID and organization + normalized domain; database constraints handle races |
| `GET /api/prospects` | Any member | optional `q`, `status` query | organization-scoped prospects | unauthorized, internal | Safe read |
| `PATCH /api/prospects/:id` | Owner, Admin, Analyst | optional status, note, tags | updated prospect | validation, not found, unauthorized | Status and normalized tag replacement are idempotent; notes are append operations |
| `POST /api/import/csv` | Owner, Admin, Analyst | multipart `file`, max 2 MB | created/duplicate/error summary and row errors | invalid file, validation, unauthorized | Normalized-domain uniqueness prevents duplicates |
| `GET /api/health` | Public, sanitized | none | app/database aggregate status, non-secret Apollo description | HTTP 503 when database unavailable | Safe read, `no-store` |

Apollo organization search is currently `POST https://api.apollo.io/api/v1/mixed_companies/search`. Connection testing uses the zero-credit `GET /api/v1/auth/health` endpoint. Organization detail uses `GET /api/v1/organizations/{id}` and can consume one credit; budget authorization should be confirmed before exercising that live path.

Self-service registration creates one isolated organization, an Owner membership, and a disconnected Apollo connection. Password-reset mail is sent through Resend only when `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are configured; secrets never enter browser-delivered code.
