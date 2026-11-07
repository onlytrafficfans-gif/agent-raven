# Phase 1 operations and recovery

## Secrets and rotation

- `BETTER_AUTH_SECRET`: rotate through a controlled session invalidation window; expect existing sessions to expire.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`: provide transactional password-reset delivery. Verify the sender domain in Resend, keep the API key server-only, and rotate it in the provider before replacing the deployment secret. When either value is absent, the recovery UI fails visibly instead of claiming delivery.
- `INTEGRATION_ENCRYPTION_KEY`: 32 random bytes encoded as base64. Credentials are AES-256-GCM envelopes tagged `v1`. To rotate, deploy code that can read the old and new key IDs, re-encrypt rows transactionally, verify connection health, then retire the old key. The current Phase 1 UI disconnect/reconnect flow is the safest manual rotation path.
- Apollo credentials are returned by neither list nor mutation interfaces. Logs redact key/token/secret/password/credential fields.

## Authentication retention

Run `npm run auth:cleanup` to inspect counts without changing data. Run `npm run auth:cleanup:execute` from a trusted maintenance environment to transactionally delete sessions and verification records whose `expiresAt` is at or before the captured cutoff. Output contains only the cutoff and aggregate before/deleted/after counts; it never contains tokens, user identifiers, email addresses, or secret values. Schedule the execute command daily on durable worker or hosting cron infrastructure after production database access is configured. Do not run it inside an ordinary serverless request.

The cleanup integration test creates isolated expired and active records, proves exactly the expired session and verification are deleted, and proves the active pair remains. On November 5, 2026 at 5:57 AM Pacific, the local dry run found 60 expired sessions and zero expired verification rows; the measured execute run removed those 60 sessions and preserved the active session.

## Health monitoring

Use `GET /api/health/live` only to determine whether the application process can serve HTTP. It performs no database or provider work and stays independent from downstream failures. Use `GET /api/health` for traffic readiness: it executes a real PostgreSQL query, reports rounded query latency, marks latency of 250 ms or more as `degraded`, returns HTTP 503 only when the database is unavailable, and emits `Server-Timing`, `x-health-status`, and the correlated request ID. Both routes are public, `no-store`, and return sanitized status only; Apollo credential state remains restricted to authenticated organization members.

Configure the hosting platform liveness check against `/api/health/live` and readiness/deployment verification against `/api/health`. Alert on any readiness HTTP 503, sustained `x-health-status: degraded`, or structured `health.database_degraded` log. Do not restart otherwise healthy application processes merely because a downstream database is temporarily unavailable.

## Database recovery

Use managed PostgreSQL point-in-time recovery with daily backups. Quarterly, restore the latest backup into an isolated database, verify migrations and critical table counts, then destroy the isolated copy. Credential ciphertext is useful only with the separately protected encryption key; back up and rotate that key using the hosting provider's secret manager.

Run `npm run db:backup` for a private custom-format dump and SHA-256 checksum. Run `npm run db:restore-drill` to create a new backup, restore it into a randomly named isolated database, compare all authentication, organization, integration, search, prospect, audit, and Prisma migration table counts, run `prisma migrate status`, and force-remove the isolated database. Dumps, checksums, and JSON drill reports are mode `0600` under the ignored `.recovery/` directory. Set `PG_BIN` if PostgreSQL client tools are outside the known system or bundled paths. Non-local operations fail closed unless `ALLOW_REMOTE_RECOVERY_OPERATION=true` is deliberately supplied.

Latest measured local drill on November 4, 2026 at 6:11 AM Pacific: **PASS**. PostgreSQL 16 restored 17 critical tables, including `ApiRateLimitBucket`, with exact row-count parity; the migration was current; the isolated database was removed; and the full drill completed in 13.4 seconds. This proves the workflow locally; production RPO/RTO still depend on the selected managed PostgreSQL backup service and a production restore exercise.

Target Phase 1 objectives: 24-hour recovery point and 4-hour recovery time. The local drill is below the RTO target, while the production RPO and RTO remain operating targets until measured against the deployed managed database.

## Incidents

- Password email failure: verify the Resend sender domain, API key, provider activity, and deployment variables. Reset tokens expire after one hour and all existing sessions are revoked after a successful reset.
- Invalid key: mark connection invalid, rotate in Apollo, reconnect, and inspect the credential audit event.
- Permission failure: add only the required Apollo scopes; do not broaden to a master key without review.
- Rate limit: honor `Retry-After`; inspect the organization and bucket key before changing policy. The app does not retry paid calls automatically.
- Budget block: validate recorded usage and obtain explicit approval before changing `APOLLO_MONTHLY_OPERATION_LIMIT`.
- Provider outage: keep CSV fallback available; do not represent fixture or CSV records as live Apollo data.
- Suspected leakage: revoke the Apollo key, rotate application secrets, inspect structured logs/artifacts, and notify affected operators.

Every app-owned JSON API response returns a bounded correlation ID in both the response body and `x-request-id` header. Preserve that ID in support and incident records to join browser failures, structured logs, provider usage, and audit entries. User-supplied IDs containing spaces, email-like characters, control characters, or more than 64 characters are discarded and replaced with a UUID so untrusted values cannot become log or audit identifiers.

Tenant boundaries are enforced by resolving organization membership from the authenticated server session and applying that organization ID to every prospect query and mutation. The browser suite creates two independent organizations and proves cross-tenant list and update attempts cannot expose or modify the other tenant's record. Preserve this negative-path test whenever adding exports, jobs, caches, files, or administrative routes.

The Phase 1 permission matrix is: Owner and Admin may manage the Apollo connection; Owner, Admin, and Analyst may search, view provider detail, import, create, and update prospects; Viewer is read-only. Automated browser tests exercise all four real authenticated roles against these server boundaries while Apollo is disconnected, so the checks never trigger an external provider call or credit charge.

Prospect creation is race-safe at the database boundary. Organization-scoped unique constraints cover provider identity and normalized domain, while the API converts a concurrent unique-key conflict into the already-persisted prospect instead of surfacing an error or creating a second audit event. The desktop/mobile production-browser suite verifies this with 12 simultaneous identical creates and a 12-request replay against PostgreSQL. Preserve that test whenever prospect ingestion, bulk import, jobs, or provider adapters change.

API abuse controls use PostgreSQL fixed-window buckets rather than process memory, so every application instance observes the same counters. Paid Apollo search/detail traffic is capped at 10 attempts per organization per minute; credential tests at 5 per organization per 10 minutes; disconnects at 20 per organization per minute; CSV imports at 10 per user per minute; prospect creates at 60 per user per minute; and prospect updates at 120 per user per minute. HTTP 429 responses carry the same positive delay in `Retry-After` and the correlated JSON error. New buckets opportunistically delete rows older than 24 hours, and organization deletion cascades to its buckets.

## Browser security policy

All routes receive a same-origin Content Security Policy, clickjacking denial through CSP and `X-Frame-Options`, MIME sniffing protection, a restricted referrer policy, disabled camera/microphone/geolocation/browser-topic permissions, and same-origin opener/resource isolation. The production browser suite verifies these headers. HSTS is intentionally deferred until the final HTTPS hostname and subdomain policy are verified; enable it at the deployment edge only after that decision.

## Costs and limits

Apollo currently documents organization search as one credit per page (up to 100 results), while organization detail/enrichment can consume one credit per organization. The app enforces both a 10-per-minute organization throttle and its monthly operation limit before provider calls; Apollo's plan, credit balance, scopes, and per-endpoint rate limits remain the external source of truth. PostgreSQL and Vercel costs depend on the selected plans and traffic.

## Continuous verification

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. It provisions an isolated PostgreSQL 16 service, applies migrations, seeds a CI-only owner, runs typecheck, lint, unit tests, a production build, validates the production environment contract, and runs the complete desktop/mobile browser suite. CI values are non-production test credentials; deployment secrets remain configured only in the hosting provider. Failed browser runs retain Playwright diagnostics for seven days.

## Deployment preflight

Run `npm run deploy:check` in the production environment before migrations or deployment. The command fails closed when PostgreSQL, the canonical HTTPS auth origin, the auth secret, the 32-byte credential-encryption key, password-email delivery, or the Apollo operation budget is absent or malformed. Its JSON output contains only boolean state and actionable error names, never secret values. Passing preflight proves configuration shape only; it does not prove database reachability, sender-domain verification, Apollo authorization, or live provider behavior. Verify those separately through the health endpoint and acceptance runbook.

After deployment, run `DEPLOYMENT_URL=https://your-canonical-host.example npm run deploy:verify`. The verifier accepts only a canonical HTTPS origin, follows no redirects, checks sanitized liveness and real PostgreSQL readiness, matches correlation and timing headers, and verifies the direct sign-in security policy. HTTP is rejected except for an explicitly enabled loopback-only local check. See [the release checklist](RELEASE_CHECKLIST.md) for pre-deploy, post-deploy, evidence, and rollback requirements. A local verifier pass does not establish that a future public deployment passed.
