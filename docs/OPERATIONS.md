# Phase 1 operations and recovery

## Secrets and rotation

- `BETTER_AUTH_SECRET`: rotate through a controlled session invalidation window; expect existing sessions to expire.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`: provide transactional password-reset delivery. Verify the sender domain in Resend, keep the API key server-only, and rotate it in the provider before replacing the deployment secret. When either value is absent, the recovery UI fails visibly instead of claiming delivery.
- `INTEGRATION_ENCRYPTION_KEY`: 32 random bytes encoded as base64. Credentials are AES-256-GCM envelopes tagged `v1`. To rotate, deploy code that can read the old and new key IDs, re-encrypt rows transactionally, verify connection health, then retire the old key. The current Phase 1 UI disconnect/reconnect flow is the safest manual rotation path.
- Apollo credentials are returned by neither list nor mutation interfaces. Logs redact key/token/secret/password/credential fields.

## Database recovery

Use managed PostgreSQL point-in-time recovery with daily backups. Quarterly, restore the latest backup into an isolated database, verify migrations and critical table counts, then destroy the isolated copy. Credential ciphertext is useful only with the separately protected encryption key; back up and rotate that key using the hosting provider's secret manager.

Run `npm run db:backup` for a private custom-format dump and SHA-256 checksum. Run `npm run db:restore-drill` to create a new backup, restore it into a randomly named isolated database, compare all authentication, organization, integration, search, prospect, audit, and Prisma migration table counts, run `prisma migrate status`, and force-remove the isolated database. Dumps, checksums, and JSON drill reports are mode `0600` under the ignored `.recovery/` directory. Set `PG_BIN` if PostgreSQL client tools are outside the known system or bundled paths. Non-local operations fail closed unless `ALLOW_REMOTE_RECOVERY_OPERATION=true` is deliberately supplied.

Measured local drill on October 17, 2026 at 11:56 AM Pacific: **PASS**. PostgreSQL 16 restored 16 critical tables with exact row-count parity, the migration was current, the isolated database was removed, and the full drill completed in 11.3 seconds. This proves the workflow locally; production RPO/RTO still depend on the selected managed PostgreSQL backup service and a production restore exercise.

Target Phase 1 objectives: 24-hour recovery point and 4-hour recovery time. The local drill is below the RTO target, while the production RPO and RTO remain operating targets until measured against the deployed managed database.

## Incidents

- Password email failure: verify the Resend sender domain, API key, provider activity, and deployment variables. Reset tokens expire after one hour and all existing sessions are revoked after a successful reset.
- Invalid key: mark connection invalid, rotate in Apollo, reconnect, and inspect the credential audit event.
- Permission failure: add only the required Apollo scopes; do not broaden to a master key without review.
- Rate limit: honor `Retry-After`; the app does not retry paid calls automatically.
- Budget block: validate recorded usage and obtain explicit approval before changing `APOLLO_MONTHLY_OPERATION_LIMIT`.
- Provider outage: keep CSV fallback available; do not represent fixture or CSV records as live Apollo data.
- Suspected leakage: revoke the Apollo key, rotate application secrets, inspect structured logs/artifacts, and notify affected operators.

## Browser security policy

All routes receive a same-origin Content Security Policy, clickjacking denial through CSP and `X-Frame-Options`, MIME sniffing protection, a restricted referrer policy, disabled camera/microphone/geolocation/browser-topic permissions, and same-origin opener/resource isolation. The production browser suite verifies these headers. HSTS is intentionally deferred until the final HTTPS hostname and subdomain policy are verified; enable it at the deployment edge only after that decision.

## Costs and limits

Apollo currently documents organization search as one credit per page (up to 100 results), while organization detail/enrichment can consume one credit per organization. The app enforces its own monthly operation limit before search calls; Apollo's plan, credit balance, scopes, and per-endpoint rate limits remain the external source of truth. PostgreSQL and Vercel costs depend on the selected plans and traffic.
