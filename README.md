# Agent.Raven

Agent.Raven is an internal B2B customer-acquisition operating system. This repository intentionally implements **Phase 1 only**: authenticated, organization-scoped company discovery through Apollo; company detail; race-safe prospect saving; and a durable, searchable prospect CRM. Future modules are visible as disabled `Planned` navigation.

## Local setup

Requirements: Node.js 22+, npm 12+, and PostgreSQL 15+.

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Create the PostgreSQL database named by `DATABASE_URL`.
3. Run `npm install --legacy-peer-deps` (the flag resolves an optional Better Auth/Svelte peer range; Next.js does not use that adapter).
4. Run `npm run db:generate && npm run db:deploy`.
5. Set strong `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` values, then run `npm run db:seed`.
6. For password-reset delivery, configure `RESEND_API_KEY` and a verified `AUTH_EMAIL_FROM` sender. Without both values, the recovery screen reports that delivery is not configured and does not pretend an email was sent.
7. Run `npm run dev` and sign in at `http://127.0.0.1:3000/sign-in`, or create a self-service account at `/sign-up`.

The browser suite uses real authentication, account registration, workspace provisioning, password-reset tokens, session revocation, PostgreSQL, persistent API throttling, CSV import/export, audited privacy deletion/suppression, update, and reload paths. Owner/Admin exports are tenant-scoped, rate/size limited, formula-safe, and audited. Confirmed deletion removes saved prospect data and blocks the same domain/provider identity from API or CSV re-import. Temporary users, workspaces, prospects, suppressions, sessions, rate-limit buckets, audit rows, and orphan tags are marked and removed automatically. Provider adapter responses remain mocked only inside unit tests; the running application has no fixture mode.

Run `npm run auth:cleanup` for a read-only count of expired sessions and password-reset verifications. Run `npm run auth:cleanup:execute` from a trusted maintenance environment to delete only records expired at the command cutoff. Schedule the execute command daily after production database access is configured; it never prints tokens, email addresses, or session identifiers.

Use `/api/health/live` for process liveness and `/api/health` for database-backed readiness. The readiness response is public but sanitized, reports rounded PostgreSQL latency, and returns HTTP 503 only when the database query fails.

Unexpected server failures produce structured, sanitized error events for the hosting log drain. They include safe route/error classification only and exclude request URLs, query strings, headers, bodies, exception messages, stack traces, reset recipients, and secret-bearing fields.

Owner and Admin users can inspect real organization-scoped Apollo usage and sanitized audit actions in Settings. Paid search/detail operations reserve their monthly allowance atomically in PostgreSQL before contacting Apollo, so concurrent requests cannot spend the same remaining capacity. The view uses a UTC calendar-month window and never exposes credentials, audit metadata, or provider response content. Analyst and Viewer roles cannot access this operational evidence.

The suite defaults to port 3000. If that port is already occupied, run it with an isolated port such as `E2E_PORT=3100 npm run test:e2e`; the test server automatically uses the matching Better Auth origin.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run db:restore-drill
npm run deploy:check
DEPLOYMENT_URL=https://your-canonical-host.example npm run deploy:verify
```

The recovery drill creates a private PostgreSQL dump, restores it into a randomly named isolated database, verifies critical table counts and migrations, and removes the isolated database. Recovery artifacts remain local under the ignored `.recovery/` directory.

See [API contracts](docs/API.md), [operations](docs/OPERATIONS.md), the [production release checklist](docs/RELEASE_CHECKLIST.md), and the [acceptance map](docs/PHASE1_IMPLEMENTATION_PLAN.md).

## Deployment

The application is Vercel-compatible. Provision managed PostgreSQL, set the documented environment variables, run `npm run deploy:check` before release, run `npm run db:deploy` in the release pipeline, seed the first owner through a trusted administrative environment, and deploy. Then run `npm run deploy:verify` against the canonical HTTPS origin. Preflight validates configuration shape; post-deploy verification checks the live application, database readiness, correlation/timing contract, and sign-in security headers. Neither command proves external account ownership or Apollo provider acceptance.
