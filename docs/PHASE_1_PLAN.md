# Agent.Raven Phase 1 implementation plan

Active phase: Phase 1 — authenticated business discovery and prospect persistence.

## Acceptance map

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Authentication and tenant authorization | Signed, HTTP-only sessions; server guards; organization membership and role checks | Unit tests plus protected-route/API checks |
| Durable data | Prisma schema and migration for organizations, users, memberships, integrations, searches, prospects, notes, tags, usage, and audit logs | Migration, repository integration tests, reload/restart check |
| Apollo configuration | Encrypted server-only credential storage, connection test/disconnect, typed adapter and honest error mapping | Contract tests; live acceptance remains blocked without credential |
| Business discovery | Validated server-side form, capability-aware filters, paging and explicit provider states | Schema/adapter tests and browser workflow |
| Prospect save | Transactional idempotency, provider/domain unique keys, conflict state | Duplicate and concurrent-save tests |
| CRM | Search/filter/sort/pagination, detail, statuses, notes, tags | Integration and browser tests |
| CSV fallback | Validated CSV import with per-row errors and `CSV import` provenance | Parser/deduplication tests |
| Operations | Budget guard, correlation IDs, redacted structured logs, health and audit events | Unit tests and health inspection |
| Documentation | API reference, environment template, local/deploy/runbooks | Source inspection |

Later phases are navigation-only, disabled, and labeled Planned.
