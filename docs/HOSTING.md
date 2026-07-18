# Hosting Strategy — NightLifeNext

Status: decided · Owner: Eddy · Last updated: 2026-07-18
Cross-ref: `docs/ARD.md` AD-15, `AGENTS.md` §9.11

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
│  Hetzner VPS + Coolify                                     │
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

### Staging + Production on Hetzner

The live app has characteristics that favor a persistent VPS over serverless:

| Factor | Vercel (serverless) | Hetzner VPS |
|---|---|---|
| **SSE real-time** | Cold starts, Lambda churn | Persistent connections, instant |
| **DB connections** | Pool churn per invocation | Stable connection pool |
| **Traffic pattern** | Pay-per-invoke (idle weekdays, peak weekends) | Fixed cost, predictable |
| **Cost at scale** | $500–2k/mo at 5+ venues | $30–50/mo VPS |
| **Long-running work** | 60s function limit | No limit |
| **Infrastructure parity** | Staging ≠ prod if prod is VPS | Staging = prod |

Coolify provides the deployment experience: git-push auto-deploys, Let's
Encrypt SSL, Docker orchestration, environment variable management, rollbacks,
and monitoring — filling the gap between raw VPS and Vercel's managed DX.

### Why not Vercel for staging

Testing live features on Vercel then shipping on a VPS introduces a class of
bugs that only surface in production: connection pooling behavior, SSE
persistence under load, cron execution timing, and cold-start latency. Staging
must be prod-identical to catch these before customers do.

## Environment mapping

| Environment | Host | Branch | DB | Stripe |
|---|---|---|---|---|
| `dev` | Local machine | any | PGlite or local PG | Test keys |
| `staging` | Hetzner/Coolify | `dev` | Staging Postgres | Test keys |
| `production` | Hetzner/Coolify | `master` | Production Postgres | Live keys |
| `demo` | Vercel | `master` | None | None |

## Deployment flow

Full branching strategy is in `AGENTS.md` §10.8.

```
feature/NN-name ──PR──► dev (staging on Hetzner) ──PR──► master (prod + demo)
fix/bug-name    ──PR──►          │                              │
refactor/name   ──PR──►          │                              │
                          auto-deploy                    auto-deploy
                          Hetzner staging               Hetzner prod +
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

| Stage | Vercel | Hetzner | Postgres | Total |
|---|---|---|---|---|
| Pre-revenue | Free (demo) | ~€10/mo (shared VPS) | ~€0 (PGlite or small managed) | ~€10/mo |
| 3–5 venues | Free (demo) | ~€20–30/mo | ~€10–20/mo (managed) | ~€30–50/mo |
| 10+ venues | Free (demo) | ~€40–80/mo (dedicated) | ~€30–50/mo | ~€70–130/mo |

Compare: Vercel Pro + Neon at 10 venues would run $500–2k/mo for equivalent
compute + database + bandwidth.

## Future considerations

- **Separate VPSes** for staging and production when load justifies it.
- **Managed Postgres** (Hetzner's own or a provider like Supabase/Neon) if
  self-hosted PG ops becomes a burden.
- **CDN/edge caching** for static assets via Cloudflare in front of the VPS.
- **Horizontal scaling** via multiple Coolify nodes if a single VPS maxes out.
