# Production release checklist

Use this checklist for every production release. Keep the command output and deployment identifier in the release record. A successful local or CI run is not evidence that the public deployment works.

## Before deployment

- Confirm the intended commit passed the complete `Production verification` workflow on `main`.
- Confirm the release owner, deployment target, canonical HTTPS origin, and rollback target.
- Run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` from the intended commit.
- Run `npm run deploy:check` with production variables. It must pass without copying secret values into the release record.
- Confirm managed PostgreSQL backups and point-in-time recovery are enabled. Record the latest successful restore drill and verify the migration is backward compatible with the rollback target.
- Confirm `/api/health/live` is the process liveness probe and `/api/health` is the traffic readiness probe.
- Confirm the daily `npm run auth:cleanup:execute` job is scheduled in durable infrastructure.
- Keep Apollo disconnected unless the credential, account authority, operation budget, and credit-consuming acceptance calls have been explicitly approved.

## Deployment

1. Take or confirm the provider-managed database recovery point.
2. Run `npm run db:deploy` once from the trusted release environment.
3. Deploy the exact verified commit without seeding test or fixture data.
4. Wait for the platform readiness check before shifting traffic.
5. Do not run a destructive down migration during rollout or rollback.

## Post-deployment evidence

Run from a trusted operator environment:

```bash
DEPLOYMENT_URL=https://your-canonical-host.example npm run deploy:verify
```

The command fails unless the URL is a canonical HTTPS origin, liveness is operational, readiness proves PostgreSQL is operational, correlation and timing headers match the contract, and the direct sign-in response carries the required browser security policy. Its JSON result contains status booleans and measured database latency only; it does not retain response bodies or secret values.

Then verify manually:

- the canonical origin does not redirect unexpectedly and TLS is valid;
- HSTS is enabled at the edge only after the final hostname and subdomain policy is approved;
- sign-up, sign-in, sign-out, Remember me, and password reset work with the verified sender;
- an authorized member can create, edit, filter, and reload a real persisted prospect;
- logs contain the smoke-test correlation IDs and no secrets;
- alerting detects readiness failure without treating a dependency failure as a dead process.

Apollo live acceptance remains a separate approval-gated exercise. Record the approved budget, run the required search/detail calls, save five actual companies, repeat the search for deduplication evidence, and redact provider identifiers and credentials from artifacts.

## Rollback

- Roll application traffic back to the recorded compatible deployment.
- Do not reverse a migration unless a separately reviewed, non-destructive rollback migration exists.
- If data integrity is affected, stop writes and use the managed point-in-time recovery procedure; preserve the original database for investigation.
- Re-run `npm run deploy:verify` against the rollback deployment before restoring normal traffic.
- Record the incident, affected commit, database recovery point, verification result, and follow-up owner.

## Release decision

A release is `PASS` only when CI, environment preflight, migration, deployed smoke verification, and required manual checks have evidence. Use `BLOCKED` when an owner decision or credential is missing and `FAIL` when a check ran and did not meet its contract. Never convert `UNTESTED` into `PASS`.
