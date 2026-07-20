# Hosting Strategy — NightLifeNext

Status: decided · Owner: Eddy · Last updated: 2026-07-20
Cross-ref: `docs/ARD.md` AD-15, `AGENTS.md` §9.11 ·
VPS provisioning/hardening: `docs/RUNBOOK-VPS-SETUP.md`

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

**Privacy compliance driver:** customer data (guest PII, staff records, payment
metadata) must remain in Canada to satisfy PIPEDA and Quebec's Law 25 without
requiring a cross-border Privacy Impact Assessment. OVHcloud's Beauharnois, QC
data center (region code `BHS`) keeps all live data on Canadian soil.

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
| **Compose stack** | `npm run dev:stack` | Real Postgres 17 | Via bind mount | Mode-pair testing, LISTEN/NOTIFY, migration validation |

The compose stack (`compose.yaml`) runs four services by default:

- `db` — Postgres 17 on port 5432
- `migrate` — one-shot: applies migrations + idempotent seed
- `app-live` — Next.js dev server on port 3000 (`NEXT_PUBLIC_APP_MODE=live`)
- `app-demo` — Next.js dev server on port 3001 (`NEXT_PUBLIC_APP_MODE=demo`, no DB)

A fifth service, `app-prod`, runs only under the `prod-shape` profile (below).

Dev-grade secrets are embedded in the compose file — `docker compose up` works
on a clean clone with no `.env`. The `app-demo` service has no `DATABASE_URL`
so the demo resource guard is exercised exactly as it would be on Vercel.

Helper scripts:

- `npm run dev:stack` — start everything
- `npm run dev:stack:reset` — `down -v` (wipes DB) then `up` (factory reset)
- `npm run dev:stack:prod-shape` — builds and serves via the `runner` Dockerfile
  stage (port 3100), catching static-generation and Suspense errors that dev
  mode forgives

An optional `prod-shape` compose profile builds the `runner` Dockerfile stage
and serves on port 3100 — useful for verifying `next build` behavior locally.

Integration tests (`npm run test:integration`) use PGlite in-process and never
require Docker.

## Environment mapping

| Environment | Host | Branch | DB | Stripe |
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

## Future considerations

- **Separate VPSes** for staging and production when load justifies it.
- **Managed Postgres** (OVHcloud's own or a Canadian-hosted provider) if
  self-hosted PG ops becomes a burden — must remain in Canada for Law 25.
- **CDN/edge caching** for static assets via Cloudflare in front of the VPS.
- **Horizontal scaling** via multiple Coolify nodes if a single VPS maxes out.
