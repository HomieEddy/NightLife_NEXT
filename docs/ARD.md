# ARD — Architecture Requirements & Decisions

Status: draft for Phase 2 · Companion to `docs/PRD.md` and `docs/DDD.md`

Each decision: context → choice → alternatives considered → consequences. These are
defaults, not dogma — overturn one by editing this file in the same PR that departs
from it (AGENTS.md §9.9).

## AD-1 · Runtime: stay inside Next.js

**Choice:** One Next.js 16 app (current repo). Backend = route handlers under
`src/app/api/` + server actions for form-shaped mutations. No separate API service.

**Alternatives:** Separate Node/Fastify API (more infra, nothing needs it yet);
tRPC (nice DX but couples the contract to a framework — plain handlers + Zod keep
the service-interface seam honest).

**Consequences:** Deployment stays one unit. The mock-service seam maps 1:1: each
`mockXService` method body becomes a `fetch` to a route handler (reads) or a server
action (writes). Long-lived work (report scheduler, Stripe webhooks) also fits:
webhooks are route handlers; scheduled runs use platform cron (AD-9).

## AD-2 · Database: PostgreSQL (managed) + Prisma

**Choice:** PostgreSQL on a managed provider (Neon; any managed PG works). Prisma
as ORM — the codebase already annotates types with "mirror as Prisma models"
(`src/lib/types.ts` TODO).

**Alternatives:** Drizzle (fine choice; Prisma wins on the existing TODO contract,
migration tooling and team familiarity); SQLite/Turso (multi-tenant + concurrent
writes on Fri-night load wants Postgres).

**Consequences:** `prisma/schema.prisma` becomes the source of truth; `types.ts`
derives from generated types (AGENTS.md §9.3). Migrations via `prisma migrate`.
Integration tests run against real Postgres (AD-10).

## AD-3 · Multi-tenancy: shared schema, `venueId` column, central enforcement

**Choice:** One database, one schema; every tenant-owned table carries `venueId`.
Scoping enforced centrally with a **Prisma client extension** that injects
`where: { venueId }` from the request's session context — handlers physically
cannot forget it. Platform tables (tenants, leads, subscriptions) live outside the
scoped client and are reachable only by platform-admin routes.

**Alternatives:** Schema-per-tenant (operational pain at our scale); Postgres RLS
as primary (harder to test/debug; keep as **defense-in-depth to add later**, noted
as a hardening task, not a blocker).

**Consequences:** R2 becomes testable: integration tests create two tenants and
assert cross-reads fail. The one deliberate exception (`/admin`) uses the unscoped
client behind the platform role.

## AD-4 · AuthN/AuthZ: Better Auth

**Choice:** [Better Auth] with the organization plugin. Venue = organization;
roles = manager/host/bartender/runner; platform admins are a flag on the user.
Email+password to start (staff PINs are just short passwords), email invites for
staff (fulfils the `staff-edit-dialog.tsx` TODO). Sessions are DB-backed cookies.

**Guest access is not user auth:** guests get a **signed table token** (JWT-style,
secret-signed, revocable via a `tokenVersion` on the table) embedded in the QR URL
— fulfils the `qrSlug → signed token` TODOs. Guest session state moves server-side
keyed by that token (guest-context TODO).

**Alternatives:** Auth.js/NextAuth v5 (viable; weaker org/role story out of the
box); Clerk (hosted, fastest, but per-MAU pricing fights the per-venue SaaS model
and adds a hard vendor dependency).

**Consequences:** Replaces `auth-service.ts`, `auth-context.tsx`, `CURRENT_STAFF_ID`,
the admin password gate, and the login page's demo personas (kept as seeded real
accounts for the demo environment). Route handlers read session → role → scoped
Prisma client. Simulations removed per R7.

## AD-5 · Money: integer cents, server-computed

**Choice:** All money stored as **integer cents** (`Int` columns, e.g.
`priceCents`, `totalCents`). The server computes subtotal, per-fee lines
(`fees.ts` logic moves server-side), tip and total inside the order transaction.
Clients send intents (line items, tip %), never prices. Conversion to display
dollars happens only at the UI boundary (`formatMoney`).

**Why:** the prototype's float math (`Math.round(x*100)/100`) is a known trap; the
split-bill work already needed cent-exact distribution. This is the single most
important correctness decision in the migration.

**Consequences:** A one-time mapping layer in each service method (cents → the
dollar-float shapes pages currently expect) until pages migrate; unit tests assert
Σ(fee lines) + subtotal + tip === total exactly (R3).

## AD-6 · Realtime: SSE first, Postgres NOTIFY as the bus

**Choice:** Replace polls with **Server-Sent Events**: one `GET /api/live` route
handler per surface scope (venue-staff, venue-manager, guest-session) streaming
domain events. Publish via Postgres `LISTEN/NOTIFY` so any server instance can
fan out. Client hook (`useLiveEvents`) falls back to the existing polling when the
stream drops (satisfies R6's graceful degradation).

**Alternatives:** Managed WebSockets (Pusher/Ably) — adopt only if SSE hits limits
(bidirectional needs, >minutes-long connections on serverless). Raw WebSockets on
Vercel — poor fit for serverless runtime.

**Consequences:** All 6 polling TODOs collapse into one mechanism. Chat, broadcasts,
last call, 86 events, order/claim/show/approval changes each become typed events on
the bus. The show-floor lock's mutex moves to a DB row with `SELECT … FOR UPDATE`
(show-queue TODO), events announce it.

## AD-7 · Validation & contracts: Zod at every boundary

**Choice:** Zod schemas per route handler/server action input; schemas live beside
the handler and export inferred types. Service-layer methods keep their current
TypeScript signatures (R1) — Zod guards the wire, Prisma guards the DB.

## AD-8 · Email: Resend + React Email

**Choice:** Resend for transactional mail: staff invites (AD-4), guest receipt
send (currently a toast stub), scheduled report deliveries, lead notifications.
Templates in React Email. Dev mode logs to console instead of sending.

## AD-9 · Background work: platform cron + idempotent jobs

**Choice:** Vercel Cron (or equivalent) hitting authenticated route handlers:
`/api/jobs/run-scheduled-reports` (report-service TODO) and the nightly rollup
(AD-11). Jobs are idempotent and record runs in a `job_runs` table — rerunning is
always safe. (Promotion expiry needs no job — status derives from dates; see
plan 08.)

**Alternatives:** Queue infra (Inngest/BullMQ+Redis) — YAGNI until a job needs
retries/fan-out beyond what idempotent cron gives.

## AD-10 · Testing infrastructure

**Choice:** **Vitest** for unit + integration; integration tests hit route handlers
against a real Postgres (Testcontainers locally/CI; `.env.test` database).
**Playwright** for the E2E flows named in AGENTS.md §7. Mock-data literals become
seed fixtures (`prisma/seed.ts` imports from `src/lib/mock-data/`) — reuse, don't
rewrite (AGENTS.md §9.4). Full strategy: AGENTS.md §7 & §10.

## AD-11 · Analytics: SQL over orders, rollup table for history

**Choice:** "Tonight" queries aggregate live orders directly (indexed on
`(venueId, placedAt)`). Historical ranges read a `nightly_rollups` table written by
the nightly job (AD-9) — replaces the seeded generator. Report engine composes the
same queries; CSV rendered server-side; scheduled runs email via AD-8.

**Alternatives:** Materialized views (fine later; a plain rollup table is simpler
to backfill and test); external OLAP (wildly premature).

## AD-12 · Billing: Stripe subscriptions (SaaS only)

**Choice:** Stripe Checkout + customer portal for tenant plans; webhook handler
syncs subscription state to the `Tenant` row; plan limits enforced in the scoped
service layer (table/staff counts). Guest order payment stays out of scope (PRD §4).

## AD-13 · Environments & config

**Choice:** `dev` (local PG or Neon branch, seeded from mock data), `preview`
(per-PR, seeded, Stripe test mode), `prod`. All secrets via env vars validated at
boot with a Zod env schema (`src/lib/env.ts`). The public Live Demo is **not** an
environment of the real backend — see AD-14.

## AD-14 · Dual-mode: the mock demo is a permanent product surface

**Context:** the marketing site's Live Demo must keep running on the mock
services indefinitely — every visitor gets an isolated, self-resetting sandbox
(module state per tab) with zero backend cost and zero shared-state vandalism.
Phase 2 therefore does **not** replace mock service bodies; both implementations
co-exist. This supersedes the literal "replace the body" reading of AGENTS.md
§9.1 — the *stable interface* principle stands, the mechanism changes.

**Choice:**
- **Contract from the mock:** `type XService = typeof mockXService`. The real
  implementation is declared `satisfies XService` — signature drift is a compile
  error, so the mock and real APIs cannot diverge silently.
- **Selector layer:** `src/lib/services/x-service.ts` exports the plain name:
  `export const xService: XService = isDemoMode() ? mockXService : realXService`.
  Pages import **only** from `src/lib/services/`; an ESLint
  `no-restricted-imports` rule confines `mock-services/*` imports to selectors,
  tests and seeds. Call sites change imports once (mechanical), then never again.
- **Mode = build-time env:** `NEXT_PUBLIC_APP_MODE=demo|live`, one repo, two
  deploy targets. The landing page's "Live demo" links to the demo deployment.
  Build-time inlining lets the bundler drop the unused implementation from each
  build (live ships no mocks; demo ships no fetch layer). Runtime
  hostname-switching in a single deployment is the documented fallback if two
  deployments prove annoying.
- **Simulations are demo-gated, not deleted** (amends R7): "Simulate host
  approval", "Simulate progress", demo login personas and the admin password
  gate render behind `isDemoMode()`; live paths use the real counterparts.
- **Demo CI smoke:** the demo build runs the 5-minute-walkthrough E2E in CI so
  the demo cannot rot while live work proceeds.

**Alternatives:** seeded demo tenant on the real backend (shared mutable state
for anonymous visitors, reset crons, infra cost, slower than memory — wrong tool
for a marketing demo); runtime switching (fallback above).

**Consequences:** wherever a plan says "swap the method body of
`mockXService.m`", read "implement `realXService.m` satisfying the mock's type
and wire the selector". The `mockXService → xService` renames never happen — the
selector owns the plain name; mocks keep theirs. Mocks remain the seed/fixture
source (AD-10) *and* a shipped product.

## System sketch

```
Browser (manager / staff / guest / admin UIs — unchanged pages)
   │  imports from src/lib/services/* selectors (AD-14)
   ▼
xService = demo build → mockXService (in-memory, self-resetting)
           live build ↓ realXService  ──►  fetch / server actions
   ▼
Next.js route handlers + server actions
   ├─ Zod input validation (AD-7)
   ├─ Better Auth session → role checks (AD-4)
   ├─ scoped Prisma client (venueId injected, AD-3)
   │       ▼
   │   PostgreSQL ── append-only ledgers, integer cents, LISTEN/NOTIFY
   ├─ SSE /api/live streams ◄── NOTIFY fan-out (AD-6)
   ├─ Stripe webhooks (AD-12)      ├─ Resend email (AD-8)
   └─ Cron job handlers (AD-9)     └─ nightly_rollups (AD-11)
```
