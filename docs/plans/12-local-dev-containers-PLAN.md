# 12 — Containerized Local Dev · PLAN

**Status: complete.**

Goal: one `docker compose up` boots the entire local environment — the **live**
app, the **demo** app, and Postgres — so testing a feature across both build
modes stops requiring two terminals, a hand-managed database, and a
correctly-remembered set of env vars. This is a `chore/` plan: it changes how
we run the app locally, never what the app does.

Preconditions: none on the feature plans. The existing `docker-compose.yml`
(bare Postgres) is the seed; this plan absorbs and replaces it. The PGlite
integration-test harness (`src/server/test-pglite.ts`) and the
`@testcontainers/postgresql` devDependency are explicitly **out of scope and
preserved as-is** — tests keep running in-process with zero Docker
requirement, per §7b.1.

## Reasoning

Interpretation of "both live and demo running on the same docker container":
one compose **stack**, not literally one container. `NEXT_PUBLIC_APP_MODE` is
resolved per-process and each build owns different routes (`/` redirect,
`/demo`, `/admin` — see the appendix gotchas), so live and demo must be two
Next.js processes. They share one image and one stack; the deliverable is a
single command that brings up all three services on stable ports.

Why containers at all, given `dev:pglite` exists? Three gaps:

1. **Mode-pair testing.** Features that touch the selector layer or the
   demo/live route split (§ appendix: each build owns its home) must be
   verified in both modes. Today that's two shells with different env; the
   stack makes it `docker compose up` + two browser tabs (3000 live,
   3001 demo).
2. **Prod-shaped database.** PGlite is superb for tests but is not the
   Postgres that staging/prod run (AD-15). LISTEN/NOTIFY-backed SSE (plan 07)
   and migration SQL deserve periodic runs against real `postgres:17` — the
   compose stack makes that the default local live path instead of a chore.
3. **Onboarding determinism.** A new machine (or a wiped one) reaches a
   working two-mode environment from `git clone` + Docker Desktop, with
   migrations and seed applied automatically — no Node version drift, no
   ".env archaeology".

What this plan is **not**: it is not the production Dockerfile for
Coolify/OVHcloud. Coolify builds its own deployment (AD-15); if it can later
reuse the `runner` stage of our Dockerfile, fine, but prod deployment config
is out of scope here. It also does not deprecate `npm run dev` /
`dev:pglite` — the fastest inner loop (native HMR, in-process DB) stays
first-class; compose is the *integration-shaped* loop.

## Design choices

- **One multi-stage `Dockerfile`, two targets.**
  - `deps` → `dev` target: `node:22-alpine`, `npm ci`, runs `next dev`.
    Source is **bind-mounted** from the host so HMR works inside the
    container; `node_modules` and `.next` live in named volumes so the host's
    Windows/Linux binary mismatch (esp. Prisma engines, SWC) never bites.
  - `builder` → `runner` target: `next build` + `next start`, standalone
    output. Used by an optional `docker compose --profile prod-shape up` for
    verifying production behavior (static generation, the
    `useSearchParams`/Suspense error class) — not part of the default dev
    stack.
- **`compose.yaml` (replaces `docker-compose.yml`) — four services:**

  | Service | Image/target | Port | Env |
  |---|---|---|---|
  | `db` | `postgres:17-alpine` | 5432 | user/pass/db `nightlife`, healthcheck `pg_isready` |
  | `migrate` | `dev` target, one-shot | — | runs `prisma migrate deploy` + seed, `depends_on: db healthy` |
  | `app-live` | `dev` target | 3000 | `NEXT_PUBLIC_APP_MODE=live`, `DATABASE_URL=postgresql://…@db:5432/nightlife`, dev-grade `AUTH_SECRET`/`QR_TOKEN_SECRET` defaults, `depends_on: migrate completed` |
  | `app-demo` | `dev` target | 3001 | `NEXT_PUBLIC_APP_MODE=demo` only — no DB vars at all (the demo resource guard must never see them) |

- **Env lives in the compose file, not in `.env`.** The stack ships its own
  dev-grade secrets (mirroring the defaults `scripts/pglite-dev.ts` already
  uses) so `docker compose up` works on a clean clone. Real `.env` remains
  the host-native workflow's concern; compose reads it only for optional
  overrides (`NEXT_PUBLIC_DEMO_URL` cross-links, Stripe test keys when plan
  10 work needs them).
- **Seeding is idempotent or guarded.** The `migrate` one-shot runs
  `prisma migrate deploy` always and `prisma/seed.ts` only when the DB is
  empty (check a sentinel row) — a `docker compose up` after a schema change
  must not duplicate seed data. `docker compose down -v` is the documented
  "factory reset".
- **npm scripts as the front door** — nobody should need to remember compose
  flags: `dev:stack` (`docker compose up`), `dev:stack:reset`
  (`down -v && up`), `dev:stack:prod-shape` (the `runner`-target profile).
- **`.dockerignore`** mirrors `.gitignore` plus `.next`, `.pglite-data`,
  `node_modules`, `docs`, `e2e` — keeps the build context small and secrets
  out of images.
- **Integration tests unchanged.** Vitest `integration` project keeps PGlite
  in-process (`src/server/test-pglite.ts`); `@testcontainers/postgresql`
  stays available for suites that explicitly opt into real Postgres. Tests
  must keep passing with Docker not even installed — CI and the §5 ladder do
  not gain a Docker dependency from this plan.

## Implementation strategy

All on the live-track tooling surface; branch `chore/12-local-dev-containers`.

1. `Dockerfile` (`deps`/`dev`/`builder`/`runner` stages) + `.dockerignore`.
2. `compose.yaml`: `db` (carry over the existing volume + healthcheck),
   `migrate` one-shot with guarded seed, `app-live`, `app-demo`; delete
   `docker-compose.yml`.
3. npm scripts (`dev:stack`, `dev:stack:reset`, `dev:stack:prod-shape`) and
   the optional `prod-shape` profile.
4. Docs: `docs/HOSTING.md` gains a "local topology" section (native inner
   loop vs compose stack vs staging); AGENTS.md appendix gains the one-liner
   for where local live testing can now run (§9.9 same-PR rule).

## Testing

This plan's "test suite" is behavioral (§5) — it's infrastructure:

- Clean-clone boot: from a tree with no `.env`, `docker compose up` reaches
  healthy `app-live` (3000) and `app-demo` (3001); live login works against
  the seeded venue; demo `/` redirects to `/demo`.
- Guard checks: `app-demo` container has no `DATABASE_URL` (demo resource
  guard would throw); `app-live` refuses to start without its secrets only
  if compose defaults are removed — i.e. defaults actually apply.
- HMR: edit a page on the host, both containers hot-reload.
- Persistence: restart the stack — live data survives (named volume);
  `down -v` resets it; re-`up` re-seeds exactly once (idempotency guard).
- SSE over real Postgres: place a guest order in live mode, watch the staff
  page update via `/api/live/staff` (LISTEN/NOTIFY working in-container).
- Regression: `npm run test` and `npm run test:integration` pass with the
  Docker stack **stopped** (proves tests stayed Docker-free);
  `npx next build` unaffected.

## Review checklist

- No behavior change in `src/` — this plan should touch app code zero times.
- Demo service env is DB-free; live service never receives demo-only vars.
- Secrets in compose are dev-grade placeholders, clearly labeled, never real
  values; `.env` still gitignored.
- Seed guard actually idempotent (two consecutive `up`s, one seed)?
- Windows host: bind mount + volume-shadowed `node_modules` verified (this
  repo develops on Windows — the classic mount-clobbers-modules trap).
- Docs updated in the same PR (HOSTING.md, AGENTS.md appendix).

## Exit criteria

`docker compose up` from a clean clone yields both apps browsable and the
live app fully functional against containerized Postgres; integration tests
still pass with Docker stopped; old `docker-compose.yml` gone; docs describe
the three local loops (native demo, `dev:pglite`, compose stack).
