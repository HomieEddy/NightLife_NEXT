# Hosting Strategy — NightLifeNext

Status: decided · Owner: Eddy · Last updated: 2026-07-20
Cross-ref: `docs/ARD.md` AD-15, `AGENTS.md` §9.11 ·
VPS provisioning/hardening: `docs/RUNBOOK-VPS-SETUP.md` ·
Operations runbook: `docs/RUNBOOK.md`

## Decision

Three deployment targets, two hosting providers:

```
┌────────────────────────────────────────────────────────────┐
│  Vercel (free/hobby tier)                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Demo app                                            │  │
│  │  NEXT_PUBLIC_APP_MODE=demo                           │  │
│  │  No database · mock data · self-resetting sandbox    │  │
│  │  Purpose: marketing tour, public playground          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  OVHcloud VPS (Beauharnois, QC) + Coolify                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Staging                                             │  │
│  │  NEXT_PUBLIC_APP_MODE=live                           │  │
│  │  Postgres (staging DB) · 2 test venues               │  │
│  │  Purpose: QA, feature validation, pre-prod gate      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Production                                          │  │
│  │  NEXT_PUBLIC_APP_MODE=live                           │  │
│  │  Postgres (prod DB) · customer venues                │  │
│  │  Purpose: revenue, real operations                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Why this split

### Demo on Vercel

The demo build is a stateless marketing tool. It runs entirely on mock data in
the browser — no database, no secrets, no server state. Vercel's free tier
handles this indefinitely with global CDN caching and zero ops burden.

Keeping the demo on Vercel also enforces a clean separation: the demo can never
accidentally depend on real infrastructure, and demo visitors can never touch
customer data.

### Staging + Production on OVHcloud (Beauharnois, QC)

The live app has characteristics that favor a persistent VPS over serverless:

| Factor | Vercel (serverless) | OVHcloud VPS |
|---|---|---|
| **SSE real-time** | Cold starts, Lambda churn | Persistent connections, instant |
| **DB connections** | Pool churn per invocation | Stable connection pool |
| **Traffic pattern** | Pay-per-invoke (idle weekdays, peak weekends) | Fixed cost, predictable |
| **Cost at scale** | $500–2k/mo at 5+ venues | ~$12 CAD/mo VPS |
| **Long-running work** | 60s function limit | No limit |
| **Infrastructure parity** | Staging ≠ prod if prod is VPS | Staging = prod |
| **Data residency** | US/EU edge (no control) | Quebec, Canada (PIPEDA + Law 25 compliant) |

**Privacy compliance driver:** customer data (guest PII, staff records) must
remain in Canada to satisfy PIPEDA and Quebec's Law 25 without requiring a
cross-border Privacy Impact Assessment. OVHcloud's Beauharnois, QC data center
(region code `BHS`) keeps all live data on Canadian soil. External service
integrations (Resend, Twilio, Web Push, Stripe — the latter for tenant SaaS
billing only) are disclosed in the privacy policy per plan 35.

**VPS tier:** OVHcloud VPS-2 — 4 vCores, 8 GB RAM, 75 GB NVMe, 1 Gbps,
~$11.64 CAD/mo. Enough headroom for Coolify + Postgres + Next.js with room for
early multi-venue load; 1-click upscale to VPS-3/VPS-4 when needed.

Coolify provides the deployment experience: git-push auto-deploys, Let's
Encrypt SSL, Docker orchestration, environment variable management, rollbacks,
and monitoring — filling the gap between raw VPS and Vercel's managed DX.

### Why not Vercel for staging

Testing live features on Vercel then shipping on a VPS introduces a class of
bugs that only surface in production: connection pooling behavior, SSE
persistence under load, cron execution timing, and cold-start latency. Staging
must be prod-identical to catch these before customers do.

## Local development topology

Three local loops, fastest to most prod-shaped:

| Loop | Command | Database | HMR | When to use |
|---|---|---|---|---|
| **Native demo** | `npm run dev:demo` | None (mock data) | Native | UI work, demo-only features |
| **PGlite live** | `npm run dev:pglite` | In-process PGlite | Native | Live features, fastest iteration |
| **Compose stack** | `docker compose up` | Real Postgres 17 | Via bind mount | Mode-pair testing, LISTEN/NOTIFY, migration validation |

The compose stack (`compose.yaml`) runs four services by default:

- `db` — Postgres 17 on host port **5433** (mapped from 5432)
- `migrate` — one-shot: applies migrations + idempotent seed
- `app-live` — Next.js dev server on port 3000 (`NEXT_PUBLIC_APP_MODE=live`)
- `app-demo` — Next.js dev server on port 3001 (`NEXT_PUBLIC_APP_MODE=demo`, no DB)

A fifth service, `app-prod`, runs only under the `prod-shape` profile (below).

Dev-grade secrets are embedded in the compose file (overridable via
`AUTH_SECRET`/`QR_TOKEN_SECRET` env vars) — `docker compose up` works on a
clean clone with no `.env`. The `app-demo` service has no `DATABASE_URL` so
the demo resource guard is exercised exactly as it would be on Vercel.

There are no `dev:stack*` npm scripts — the stack is driven directly by
`docker compose`:

- `docker compose up` — start everything
- `docker compose down -v && docker compose up` — factory reset (wipes the DB)
- `docker compose --profile prod-shape up --build` — builds and serves via the
  `runner` Dockerfile stage (port 3100), catching static-generation and
  Suspense errors that dev mode forgives

An optional `prod-shape` compose profile builds the `runner` Dockerfile stage
and serves on port 3100 — useful for verifying `next build` behavior locally.

Integration tests (`npm run test:integration`) use PGlite in-process and never
require Docker.

## Environment mapping

| Environment | Host | Branch | DB | Stripe (tenant billing only) |
|---|---|---|---|---|
| `dev` | Local machine | any | PGlite, compose Postgres, or external PG | Test keys |
| `staging` | OVHcloud BHS/Coolify | `dev` | Staging Postgres | Test keys |
| `production` | OVHcloud BHS/Coolify | `master` | Production Postgres | Live keys |
| `demo` | Vercel | `master` | None | None |

## Deployment flow

Full branching strategy is in `AGENTS.md` §10.8.

```
feature/NN-name ──PR──► dev (staging on OVHcloud BHS) ──PR──► master (prod + demo)
fix/bug-name    ──PR──►          │                                │
refactor/name   ──PR──►          │                                │
                          auto-deploy                      auto-deploy
                          OVHcloud staging                OVHcloud prod +
                                                          Vercel demo

hotfix/critical ─────────────────────────────────PR──► master
                                                        │
                                              cherry-pick back to dev
```

- Staging auto-deploys on push to `dev`.
- Production auto-deploys on push to `master`.
- Demo auto-deploys on push to `master` (separate Vercel project, same repo).
- Hotfixes branch from `master`, merge to `master`, then cherry-pick to `dev`.
- The demo and live builds share no infrastructure or databases.

## Cost projection

| Stage | Vercel | OVHcloud | Postgres | Total |
|---|---|---|---|---|
| Pre-revenue | Free (demo) | ~$12 CAD/mo (VPS-2) | ~$0 (PGlite or self-hosted) | ~$12 CAD/mo |
| 3–5 venues | Free (demo) | ~$12–17 CAD/mo | ~$10–20/mo (managed) | ~$22–37 CAD/mo |
| 10+ venues | Free (demo) | ~$32–50 CAD/mo (VPS-4+) | ~$30–50/mo | ~$62–100 CAD/mo |

Compare: Vercel Pro + Neon at 10 venues would run $500–2k/mo for equivalent
compute + database + bandwidth.

## Database backups

Automated nightly backup via `scripts/db-backup.sh`, scheduled by cron on the
VPS (or Coolify's scheduled-backup feature where available):

```bash
# /etc/cron.d/nightlife-backup — runs daily at 3:00 AM local
0 3 * * * nightlife /opt/nightlife/scripts/db-backup.sh >> /var/log/nightlife/backup.log 2>&1
```

**Pipeline:** pg_dump → gzip → age-encrypt → rclone upload → local prune.

**Environment variables** (set in Coolify service env or /etc/default/nightlife-backup):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (required) | Postgres connection string |
| `BACKUP_DIR` | `/var/backups/nightlife` | Local staging directory |
| `AGE_PUBLIC_KEY` | (none) | age public key for encryption; skips encrypt if unset |
| `RCLONE_REMOTE` | (none) | rclone remote:path for upload; local-only if unset |
| `DAILY_RETENTION` | 7 | Daily backups to keep |
| `WEEKLY_RETENTION` | 4 | Weekly (Sunday) backups to keep |
| `MONTHLY_RETENTION` | 12 | Monthly (1st-of-month) backups to keep |

**Retention:** 7 daily + 4 weekly + 12 monthly. Pruning is a no-op on days that
aren't a Sunday or the 1st of the month — only the Sunday/1st-of-month dumps
that exceed their retention windows are removed.

**Encryption key:** generate once with `age-keygen`, store the private key in a
password manager and the public key as `AGE_PUBLIC_KEY` in the VPS env. The key
must be stored outside the VPS — losing the VPS must not lose the key. Recovery
path: retrieve the private key from the password manager, use `age --decrypt` to
recover the backup.

**Storage:** OVHcloud Object Storage (S3-compatible, Beauharnois QC) via rclone.
Staging backups use the same pipeline with shorter retention (configured via
`DAILY_RETENTION=3` on the staging VPS). Both buckets are in Canada for Law 25
compliance.

**Restore drill:** executed monthly per `docs/RUNBOOK.md §restore`. A backup
that hasn't been restored is not a backup.

## Database roles

The app connects as `nightlife_app`, not superuser. Migrations run as
`nightlife_migrate` (DDL rights) only during `prisma migrate deploy`. Grant
scripts are in `scripts/db-roles.sql` — idempotent, run once per database.

| Role | Rights | Used by |
|---|---|---|
| `nightlife_app` | CONNECT + DML (SELECT/INSERT/UPDATE/DELETE) on application tables | App runtime |
| `nightlife_migrate` | CONNECT + DDL (CREATE/ALTER/DROP TABLE/INDEX) + DML | `prisma migrate deploy` step |

**Connection strings:** Coolify deploys `DATABASE_URL` as `nightlife_app` and
sets `DIRECT_DATABASE_URL` as `nightlife_migrate` for the migrate step. The
migrate role never runs application queries; the app role can never alter
schema. Verify with: `docker exec <pg> psql -U nightlife_app -c "CREATE TABLE
test_ping (x int)"` — must fail with "permission denied".

**`sslmode=require`** is mandatory for any connection crossing a network
boundary (Coolify → separate DB server). On the same VPS with both PG and app
in Docker (the current Coolify default), `sslmode=disable` is acceptable.

## Connection pooling

The `PrismaPg` adapter in `src/features/shared/db.ts` passes `max` from
`DATABASE_POOL_MAX`. **Set it in production** — without it the adapter runs at
its default (effectively unbounded), which risks exhausting Postgres
connections under SSE load.

| Setting | Value | Rationale |
|---|---|---|
| `DATABASE_POOL_MAX` | 10 | `(4 cores × 2) + 2` = 10, with headroom for SSE LISTEN/NOTIFY channels and the migrate step |

A startup log line prints the configured pool size at boot. Tuning: observe
`pg_stat_activity` on staging under SSE load (`docker exec <pg> psql -U
nightlife_app -c "SELECT count(*) FROM pg_stat_activity WHERE backend_type =
'client backend'"`). If connections approach `DATABASE_POOL_MAX`, increase it
and re-profile. PgBouncer is deferred — one app process, one DB, same box, no
horizontal pooler needed (revisit at multi-VPS scale per Future
Considerations).

## Future considerations

- **Separate VPSes** for staging and production when load justifies it.
- **Managed Postgres** (OVHcloud's own or a Canadian-hosted provider) if
  self-hosted PG ops becomes a burden — must remain in Canada for Law 25.
- **CDN/edge caching** for static assets via Cloudflare in front of the VPS.
- **Horizontal scaling** via multiple Coolify nodes if a single VPS maxes out.
