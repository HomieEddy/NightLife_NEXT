# 17 — Database Operations & Backups · PLAN

**Status: not started.**

Goal: make the staging/production Postgres (AD-2, AD-15) operationally
trustworthy: automated backups with a **tested restore**, a least-privilege
application role, tuned connection pooling, an index/query audit, and slow
query visibility. The go/no-go checklist is blunt about the priority: a
backup you haven't restored is not a backup.

Preconditions: plan 12 (compose stack — the restore-drill sandbox); a
provisioned Coolify Postgres for staging (first deploy can precede this plan,
but nothing real goes into that DB until this plan's backup leg is done).
Branch `chore/17-database-operations`.

## Reasoning

The schema itself is in good shape by construction — Prisma migrations,
foreign keys, integer cents (AD-5), `venueId` on every tenant row. What has
never existed is the *operational* layer around it, because until OVHcloud
there was no long-lived database to operate. The riskiest gap is
restore-blindness; the cheapest high-value work is indexes (every list page
filters by `venueId` + a status/date column; Prisma only auto-indexes
uniques and some relations, so composite indexes are almost certainly
missing); the sneakiest is connection pooling (Next.js dev-style client
instantiation against a small VPS Postgres exhausts connections under SSE
load — plan 07's LISTEN connections count too).

Scope note: this plan owns the database; app-level observability (slow
*request* tracing, dashboards) is plan 16. Where they meet —
`log_min_duration_statement` output — this plan turns it on, plan 16 routes
it somewhere readable.

## Design choices

- **Backups: `pg_dump` nightly via cron on the VPS** (Coolify's scheduled
  backup for the Postgres service where available, plain cron + script
  otherwise), compressed, encrypted (age or gpg with a key held outside the
  VPS), shipped to OVHcloud Object Storage or a separate OVHcloud VPS
  (separate failure domain from the VPS disk; must remain in Canada for Law 25). Retention: 7 daily, 4 weekly, 12 monthly — pruned by the same
  script. Staging backs up too (smaller retention) because staging is where
  the restore drill runs monthly.
- **The restore drill is a documented, executed procedure**, not prose:
  `docs/RUNBOOK.md` §restore walks download → decrypt → restore into a
  scratch compose-stack Postgres → row-count and spot-check assertions →
  teardown. Executed once in this plan (with evidence pasted into the PR)
  and scheduled as a recurring calendar item. A backup script change without
  a fresh drill is a review-blocking finding.
- **Least-privilege role:** the app connects as `nightlife_app` — owner of
  the application schema's data, **not** superuser, no CREATEROLE/CREATEDB.
  Migrations run as a separate `nightlife_migrate` role (DDL rights) used
  only by the deploy-time `prisma migrate deploy` step. Connection strings
  therefore differ between the app env and the migrate step — Coolify env
  config reflects that split. `sslmode=require` for any connection crossing
  a network boundary.
- **Pooling:** one shared Prisma client (already the pattern via the scoped
  client) with an explicit `connection_limit` sized to the VPS
  (`connections ≈ (cores × 2) + spindle`, minus headroom for LISTEN/NOTIFY
  channels and the migrate step — concretely: start at 10 app + documented
  reserve, tune from `pg_stat_activity` observation on staging). PgBouncer
  is deliberately deferred: one app process, one DB, same box — a pooler
  adds an operational component with nothing to pool across. Revisit at
  horizontal scale (HOSTING.md future-considerations already flags it).
- **Index audit, evidence-driven:** enable `log_min_duration_statement =
  1000` and `pg_stat_statements`; drive the heavy pages (orders list,
  analytics ranges, movements ledger, reservations by night) on staging
  seed-scale data; add composite indexes where `EXPLAIN ANALYZE` shows
  sequential scans that hurt — expected candidates:
  `(venueId, status)` on orders, `(venueId, createdAt)` on
  orders/movements/notification_log, `(venueId, date)` on reservations and
  rollups. Indexes land as a normal Prisma migration with the EXPLAIN
  evidence in the commit body. No speculative indexes: every one cites a
  query.
- **Pagination caps:** sweep list endpoints for unbounded reads; enforce a
  server-side max page size (the UI already pages or bounds most lists —
  the cap is the backstop against a scripted `?limit=1000000`).

## Implementation strategy

1. Backup script (`scripts/db-backup.sh`): dump, encrypt, ship, prune;
   Coolify/cron wiring documented in HOSTING.md; staging first.
2. Restore drill: execute against a staging backup into the compose stack;
   write RUNBOOK.md §restore from what actually happened, not from memory.
3. Roles migration: `nightlife_app`/`nightlife_migrate` grants script (SQL,
   idempotent, checked in); Coolify env split; verify the app boots and a
   deploy migrates with the split creds.
4. Prisma client `connection_limit` + a startup log line stating pool size;
   observe `pg_stat_activity` on staging under SSE load.
5. `pg_stat_statements` + slow-query logging on; drive the heavy pages;
   index migration with EXPLAIN evidence.
6. Pagination-cap sweep with tests for one representative endpoint.

## Testing

- Behavioral (this is infrastructure — §5 applies, and the drill *is* the
  test): restore drill completes with asserted row counts; two consecutive
  backup runs prune correctly; app functions fully as `nightlife_app`
  (place an order, run a report — DDL-free paths all work); `prisma migrate
  deploy` succeeds as `nightlife_migrate` and fails as `nightlife_app`
  (proves the split is real).
- Integration: pagination cap test (request over-cap → clamped);
  existing suite green against a real Postgres via the compose stack (not
  just PGlite) once roles land — proves grants are complete.
- Evidence in the PR: EXPLAIN before/after for each added index;
  `pg_stat_activity` snapshot under SSE load showing headroom.

## Review checklist

- Restore drill actually executed — PR shows the output, not the plan.
- Backup encryption key stored outside the VPS; documented recovery path
  for the key itself.
- App role cannot ALTER/DROP/CREATE (attempted and refused in evidence).
- Every new index cites its query; no index without an EXPLAIN.
- Connection math accounts for LISTEN/NOTIFY channels (plan 07) and the
  migrate step.
- RUNBOOK.md and HOSTING.md updated in this PR (§9.9).

## Exit criteria

Staging Postgres backs up nightly to off-box encrypted storage with pruned
retention, a restore has been performed and documented end-to-end, the app
runs under a least-privilege role with migrations on a separate role,
pooling is sized and observed under realtime load, slow-query logging is
on, and every hot query path is indexed with evidence — checklist Phase 2
fully checked.
