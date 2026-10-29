# Phase 1 acceptance audit

Initial audit date: 2026-10-17. Latest local validation: 2026-10-29 (America/Los_Angeles). Environment: local Codex workspace with PostgreSQL 16.15; no authorized Apollo credential or permission to consume credits.

| Criterion | Status | Evidence / blocker |
|---|---|---|
| Protected authentication and organization RBAC | PASS | Better Auth owner login, server membership lookup, role gates, protected dashboard layout, and browser/API negative tests with stable `UNAUTHENTICATED` JSON responses; paid company detail excludes Viewer accounts |
| Tenant-isolated prospect reads and writes | PASS | Desktop/mobile tests create two real users and organizations in PostgreSQL, prove each tenant cannot list the other's prospect, reject a cross-tenant update as `NOT_FOUND`, allow the same normalized domain independently in both organizations, and confirm the original record remains unchanged. |
| Self-service account recovery and session choice | PASS (local), BLOCKED (email delivery) | Real signup creates a PostgreSQL user, credential account, isolated organization, Owner membership, and disconnected Apollo connection; reset-token consumption changes the password and revokes sessions; checked/unchecked Remember me produces persistent/session cookies. Live email delivery awaits configured Resend credentials and a verified sender. |
| Migrations and durable PostgreSQL persistence | PASS (local) | PostgreSQL 16.15 initialized; migration deployed; CSV record, audit note/status update, and reload durability exercised through the browser |
| Apollo credential encryption and zero-credit connection test | PASS (contract) | AES-256-GCM helpers; server-only route; adapter test asserts `/auth/health`; no credential echoed |
| Live roofing-company search in Las Vegas | BLOCKED | No authorized Apollo credential and no authorization for the one-credit search page |
| Real company detail | BLOCKED (live) | Explicit user-triggered detail preview, role gate, budget check, and usage record are implemented; a real response requires an authorized provider result and may consume one provider credit |
| Save five actual companies and persist after reload | BLOCKED (Apollo) | PostgreSQL persistence is verified; five actual Apollo companies require authorized live results |
| Second market without code changes | BLOCKED | Depends on live provider authorization |
| Repeat search/save without duplicates | PASS (rules/contract), BLOCKED (live) | Unique provider/domain constraints and P2002 conflict handling implemented; live scenario unavailable |
| Invalid credential state | PASS (contract), BLOCKED (live) | HTTP mapping and UI state implemented/tested; no live invalid-key exercise performed |
| CSV fallback validation and deduplication | PASS | Row validation, IDN/domain normalization, duplicate reporting, PostgreSQL persistence, and clearly labelled source |
| CRM filters, sorting, tags, and notes | PASS | Desktop/mobile browser flow persists qualified status, note, and normalized tags; reload proves durability; source, industry, location, status, tag/text search, and company-name sorting are wired to real records |
| Browser payload/log/artifact secret leakage | PASS (source/local) | credential response omission and redaction tests; live provider network inspection blocked |
| Browser security headers | PASS | Production responses omit `X-Powered-By` and enforce CSP, frame denial, MIME sniffing protection, restricted referrers and permissions, and same-origin opener/resource policies; verified by Playwright |
| Request correlation and log safety | PASS | Every app-owned JSON route emits the same bounded ID in the response body and `x-request-id` header; unsafe, secret-bearing, and oversized inbound IDs are replaced with UUIDs. Unit tests cover normalization and sanitized errors, while desktop/mobile browser tests verify unauthenticated API correlation. |
| Continuous verification | PASS | GitHub Actions run 1 passed against public commit `5ab7839`, provisioning isolated PostgreSQL 16 and running migrations, typecheck, lint, unit tests, production build, and the complete desktop/mobile Playwright suite; the same workflow runs on pull requests and pushes to `main` |
| Production environment preflight | PASS (contract), BLOCKED (live deployment) | `npm run deploy:check` validates PostgreSQL URL shape, canonical HTTPS auth origin, auth-secret strength, the 32-byte encryption key, password-email configuration, and the Apollo operation budget without printing values. The current local environment correctly fails on its local HTTP origin and absent Resend key; hosting, managed PostgreSQL, and verified sender choices remain owner blockers. |
| Backup and isolated restore | PASS (local) | Private checksum-protected PostgreSQL dump restored into an isolated database; 16 critical table counts matched, migration status passed, and the isolated database was removed in a measured 11.3-second drill |
| Desktop/mobile critical flow | PASS (real local runtime) | 20/20 Playwright checks at 1440×1000 and Pixel 7 size using Better Auth and PostgreSQL; signup, workspace provisioning, reset-token consumption, session revocation, Remember me cookies, auth rejection, tenant isolation, security headers, disconnected provider state, CSV import, select, status/note/tag edit, reload, filters, sorting, screenshots, and interrupted-request recovery verified |

## Automated evidence

- `npm test`: 6 files, 24 tests passed.
- `npm run lint`: passed with no findings.
- `npm run typecheck`: passed in strict mode.
- `npm run build`: Next.js production build passed; all Phase 1 routes compiled.
- `npm run test:e2e`: 20 passed across desktop and mobile, including real signup/workspace creation, reset-token consumption, session revocation, Remember me cookie behavior, unauthenticated route/API rejection, cross-tenant read/write rejection, same-domain tenant independence, security headers, CSV persistence, audited status/note/tag updates, reload durability, real CRM filtering, and recovery from interrupted authentication, Apollo connection, CSV import, and prospect-update requests.
- `npm audit --omit=dev`: 0 vulnerabilities. Full audit retains five high-severity findings in ESLint's development-only globbing chain; no runtime package is affected, and npm currently proposes an incompatible downgrade of `eslint-config-next` as the automated fix.
- Source secret-pattern scan: no credential-like value found outside excluded generated/artifact directories.
- `npm run db:restore-drill`: passed locally with checksum, exact 16-table row-count parity, current migration status, isolated-database cleanup, and an 11.3-second measured duration.

The Phase 1 gate remains **BLOCKED**, not complete, until every live and durability criterion is reproduced with redacted evidence.

