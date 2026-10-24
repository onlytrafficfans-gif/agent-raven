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

The browser suite uses real authentication, account registration, workspace provisioning, password-reset tokens, session revocation, PostgreSQL, CSV import, audit, update, and reload paths. Temporary users, workspaces, prospects, sessions, audit rows, and orphan tags are marked and removed automatically. Provider adapter responses remain mocked only inside unit tests; the running application has no fixture mode.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run db:restore-drill
```

The recovery drill creates a private PostgreSQL dump, restores it into a randomly named isolated database, verifies critical table counts and migrations, and removes the isolated database. Recovery artifacts remain local under the ignored `.recovery/` directory.

See [API contracts](docs/API.md), [operations](docs/OPERATIONS.md), and the [acceptance map](docs/PHASE1_IMPLEMENTATION_PLAN.md).

## Deployment

The application is Vercel-compatible. Provision managed PostgreSQL, set the documented environment variables, run `npm run db:deploy` in the release pipeline, seed the first owner through a trusted administrative environment, and deploy.
