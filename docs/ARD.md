# ARD — Architecture Requirements & Decisions

Status: living document · Companion to `docs/PRD.md` and `docs/DDD.md`.
Phase 2 has shipped plans 01–12 (see ROADMAP); decisions below are implemented
unless an "Implementation status" note says otherwise. **AD-16, AD-17 and AD-18
are decided but not yet implemented** — they govern plans 16–19, the
operations-completeness wave.

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

**Choice:** PostgreSQL + Prisma as ORM — the codebase already annotates types
with "mirror as Prisma models" (`src/lib/types.ts` TODO).

**Implementation status:** shipped. Postgres 17 self-hosted on OVHcloud
(Beauharnois, QC) via Docker/Coolify per AD-15 (supersedes the original
"managed provider (Neon)" leaning — HOSTING.md is the authority); PGlite
in-process for local dev and integration tests; `prisma/schema.prisma` is the
deployed source of truth.

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

**Implementation status:** not landed — no Resend dependency exists. Staff
invites go through Better Auth `createInvitation` and surface as copyable
invite links in the manager UI (`/invite/<id>` acceptance page); scheduled
report email is the unshipped leg of plans 09/09c (see ROADMAP parking lot).
Adopt Resend when the first mail must actually send.

## AD-9 · Background work: platform cron + idempotent jobs

**Choice:** a scheduled trigger hitting authenticated route handlers (Coolify
cron on the OVHcloud deploy per AD-15 — the live app no longer runs on Vercel):
`/api/jobs/run-scheduled-reports` (report-service TODO) and the nightly rollup
(AD-11). Jobs are idempotent and record runs in a `job_runs` table — rerunning is
always safe. (Promotion expiry needs no job — status derives from dates; see
plan 08.)

**Implementation status:** partial. The `job_runs` model exists,
`computeRollup`/`upsertRollup` are implemented and tested, and the report
engine computes due-schedule selection — but no `/api/jobs/*` handlers or
cron wiring exist yet. Ships with the AD-8 email leg (ROADMAP parking lot).

**Alternatives:** Queue infra (Inngest/BullMQ+Redis) — YAGNI until a job needs
retries/fan-out beyond what idempotent cron gives.

## AD-10 · Testing infrastructure

**Choice:** **Vitest** for unit + integration; integration tests hit route handlers
against a real Postgres via **PGlite in-process** (`src/server/test-pglite.ts` —
no Docker, no external database; this replaced the original Testcontainers
idea, which was heavier for the same guarantee). **Playwright** for the E2E
flows named in AGENTS.md §7 (`e2e/`). Mock-data literals become
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

**Choice:** `dev` (PGlite in-process, compose-stack Postgres, or external PG —
seeded from mock data), `preview`
(per-PR on OVHcloud staging, seeded, Stripe test mode), `prod` (OVHcloud production).
All secrets via env vars validated at boot with a Zod env schema (`src/lib/env.ts`).
The public Live Demo is **not** an environment of the real backend — see AD-14.
Hosting provider choices are in AD-15.

## AD-14 · Dual-mode: the mock demo is a permanent product surface AND the sandbox

**Context:** the marketing site's Live Demo must keep running on the mock
services indefinitely — every visitor gets an isolated, self-resetting sandbox
(module state per tab) with zero backend cost and zero shared-state vandalism.
Beyond marketing, the demo is the **permanent development sandbox**: every future
feature is sketched mock-first in demo mode and iterated on UX before any backend
is planned (see "Demo-first lifecycle" below). Phase 2 therefore does **not**
replace mock service bodies; both implementations co-exist. This supersedes the
literal "replace the body" reading of AGENTS.md §9.1 — the *stable interface*
principle stands, the mechanism changes.

**Choice:**
- **Contract from the mock:** `type XService = typeof mockXService`. The real
  implementation is declared `satisfies XService` — signature drift is a compile
  error, so the mock and real APIs cannot diverge silently.
- **Selector layer:** `src/lib/services/x-service.ts` exports the plain name:
  `export const xService: XService = isDemoMode() ? mockXService : realXService`.
  Pages import **only** from `src/lib/services/`. Enforcement is build-time, not
  lint-time (amends the original ESLint-rule plan): `next.config.ts` Turbopack
  aliases rewrite `@/lib/mock-services/*` to a throwing stub in live builds and
  `@/server/{auth,db}` to a throwing stub in demo builds, so the wrong
  implementation physically cannot execute — or even bundle — in the wrong mode.
  Call sites change imports once (mechanical), then never again.
- **Mode = build-time env:** `NEXT_PUBLIC_APP_MODE=demo|live`, one repo, two
  deploy targets. The landing page's "Live demo" links to the demo deployment.
  Build-time inlining lets the bundler drop the unused implementation from each
  build (live ships no mocks; demo ships no fetch layer). **The variable is
  required — `parseAppMode` throws on unset/invalid values** (fail-closed, so a
  misconfigured deploy can never silently boot the wrong mode). Local loops are
  explicit scripts: `dev:demo` (sandbox, no DB), `dev:pglite` (live, in-process
  DB), `dev:stack` (compose: Postgres + both modes), `dev:live` (external DB).
- **Demo-only until graduated:** a feature whose real branch doesn't exist yet
  hides its UI entry points (nav links, pages, buttons) behind `isDemoMode()` —
  the live build never shows a feature backed by vanishing in-memory state.
  Graduation removes the gate in the same PR that wires the selector's real
  branch.
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

**Demo-first lifecycle (every future feature):**

1. **Sketch** — mock data → `mockXService` methods → UI, in demo mode, under the
   Phase-1 working rules (AGENTS.md §1–§8). Annotate backend intent with
   `TODO(backend)` as you go; those comments seed the eventual plan.
2. **Iterate** — the demo build is the review environment; UX changes are cheap
   because no backend exists to drag along. Features killed here cost nothing.
3. **Gate** — entry points behind `isDemoMode()` while demo-only (rule above).
4. **Graduate** — when the UX is settled: write `docs/plans/NN-name-PLAN.md`
   (same template), implement the real branch `satisfies` the mock's type, wire
   the selector, remove the gate — one PR, per the roadmap's definition of done.

## AD-15 · Hosting: Vercel (demo) + OVHcloud BHS/Coolify (staging & prod)

**Context:** the app has two distinct deployment profiles. The demo build
(`NEXT_PUBLIC_APP_MODE=demo`) is a stateless marketing tool — no database, no
secrets, pure client-side mock data. The live build is a multi-tenant backend
with Postgres, SSE real-time, persistent connections and predictable nightclub
traffic patterns (Friday/Saturday peaks, quiet weekdays).

**Choice:** three deployment targets, two hosting providers:

| Target | Host | Mode | Database | Purpose |
|---|---|---|---|---|
| **Demo** | Vercel | `demo` | None | Marketing tour, public sandbox |
| **Staging** | OVHcloud VPS (BHS) + Coolify | `live` | Postgres (separate DB) | QA, 2 test venues, feature validation |
| **Production** | OVHcloud VPS (BHS) + Coolify | `live` | Postgres (separate DB) | Customer venues, revenue |

- **Demo stays on Vercel** — it's lightweight, stateless, and fits the free/hobby
  tier indefinitely. No database cost. Vercel's edge CDN makes the demo fast
  globally with zero ops. This is the only Vercel deployment.
- **Staging and production share an OVHcloud VPS in Beauharnois, QC** (or
  separate VPSes as load grows), managed via Coolify — git-push deploys, Let's
  Encrypt, Docker orchestration. Staging runs against its own Postgres database
  with 2 dummy tenants for end-to-end feature testing in prod-identical
  infrastructure. Quebec hosting satisfies PIPEDA and Law 25 data-residency
  requirements without a cross-border Privacy Impact Assessment.
- **Coolify provides the deployment DX** — GitHub auto-deploy on push, preview
  deployments per branch, rollbacks, environment variable management, and
  monitoring. It fills the gap between raw VPS and Vercel's managed experience.

**Alternatives considered:**

- *Vercel for everything* — pay-per-invocation pricing scales poorly with
  predictable evening-peak traffic; serverless cold starts hurt SSE real-time
  (AD-6); connection pooling churn between Lambda invocations and Postgres;
  cost crosses VPS breakeven at ~3–5 paying venues (~$500–2k/mo vs ~$12 CAD/mo
  OVHcloud).
- *Vercel for staging, OVHcloud for prod* — staging would not catch
  infrastructure-parity issues (connection behavior, SSE persistence, cron
  execution). Testing on Vercel then shipping on VPS introduces a class of
  bugs that only surface in production.
- *Hetzner (Germany/Finland)* — technically capable, but customer data would
  leave Canada, triggering PIPEDA cross-border requirements and a mandatory
  Privacy Impact Assessment under Quebec's Law 25. OVHcloud BHS avoids this.
- *OVHcloud for everything including demo* — unnecessary ops burden for a
  stateless marketing page; Vercel's CDN + zero-config is strictly better for
  static-ish content with no database.

**Consequences:**
- CI deploys the demo build to Vercel and the live build to OVHcloud/Coolify —
  same repo, different build commands (`NEXT_PUBLIC_APP_MODE=demo|live`).
- Staging is the gate before production; features must pass there first.
- The demo and live builds never share infrastructure or databases.
- AD-13 environments map: `dev` = local, `preview` = OVHcloud staging,
  `prod` = OVHcloud production, demo = Vercel (not a backend environment).
- All customer PII stays in Quebec (OVHcloud BHS) — no cross-border transfer.

## AD-16 · Accountability: one audit trail, ledgers everywhere

**Context:** plans 16-19 add many actions that change money, stock, hours or a
person's ability to enter the building. `ACTION_META` already flagged the
sensitive ones (`order:gift`, `session:deny`, …) but nothing recorded who did
them. Scattering per-feature history tables would produce five half-audits and
no single answer to "what happened last night".

**Choice:**
- **One `audit_entries` table**, venue-scoped, append-only, written by every
  action whose capability is `sensitive: true` — comps and voids (16), door
  overrides and refusals (17), time-entry edits and tip closes (18), stocktake
  commits and cost changes (19), plus the pre-existing sensitive actions.
- **The audit row is written inside the same transaction as its effect.** A
  best-effort write-after is not an audit trail; if the effect commits and the
  record doesn't, the trail lies.
- **Ledger discipline is the default for domain history**, extending the pattern
  `stock_movements` already proved: `tab_adjustments`, `occupancy_events`,
  `admissions`, `time_entries`, `tip_distributions`, `incident_notes` are all
  INSERT-only, with no UPDATE/DELETE grants in production. A correction is a new
  row (reversal or supersede), never an edit.
- **Derived-not-stored stays the rule** for anything computable: session
  balances, occupancy totals, waitlist positions, pour cost, coverage gaps and
  attention items are functions over ledgers, exactly like `AttentionItem` and
  `AnalyticsSummary` are today.

**Alternatives:** per-feature history tables (five schemas, five query shapes,
no cross-cutting view); an event-sourced core (right answer for a bigger team,
disproportionate here — `domain_events` already gives an event log for the
realtime vocabulary without making it the write model).

**Consequences:** "who comped that bottle / admitted that guest / edited those
hours" is one query. Plan 29's retention job has one obvious table to schedule
alongside the guest data. Reversals mean every ledger read must respect the
supersede/reversal chain — encoded once in the pure functions, tested there.

## AD-17 · Guest identity: opt-in, pseudonymous by default

**Context:** plan 17 introduces persistent `GuestProfile` records so a host can
recognise a regular and a door can refuse a banned patron. That is a material
change to a product whose stated privacy posture (PRD §7) is "guests are
pseudonymous, first name only" — under Law 25 and PIPEDA, in a venue serving
alcohol at night.

**Choice:**
- **A profile is created only where identity was given**: a reservation, a
  guestlist entry, a door ID check, or a host explicitly tagging a party. The
  anonymous QR-order path creates no profile and links to none — it stays exactly
  as private as it is today.
- **ID verification records the check, never the document.** `dobVerified`,
  `idCheckedBy`, `idCheckedAt`, optionally a year of birth. No scans, no images,
  no document numbers — data we would have to defend and never need to read.
- **Consent is per-channel and explicit** (`marketingConsent.email/sms` with a
  capture timestamp and source), so plan 29 can honour it and CASL is satisfiable
  if marketing messaging is ever built.
- **Cross-tenant lookup is impossible by construction** — profiles are
  `venueId`-scoped like every other tenant row (AD-3), and the door search is
  covered by an explicit isolation canary. A guest known to venue A must never
  surface at venue B's door.
- **Bans are venue-local and audited**, with an optional expiry; there is no
  shared industry blacklist and we will not build one.

**Alternatives:** platform-wide guest identity (a far more valuable product and
a far worse liability — a cross-venue behavioural record of nightlife patrons;
declined); no identity at all (leaves the review's §4 gap open, and leaves a
venue unable to enforce its own ban list).

**Consequences:** plan 29's data inventory gains `guest_profiles`, `admissions`
and `incidents` with distinct retention periods (incidents longest — licence
defence). The demo build seeds fictional profiles only. Recognition features
degrade gracefully: every screen that shows profile context must render
correctly when there is no profile, because most guests won't have one.

## AD-18 · Product cost: weighted average, carried on the movement

**Context:** plan 19 adds the cost side so revenue reports can become margin
reports. Inventory costing method is a decision that is expensive to change
later, because it is baked into every historical aggregation.

**Choice:** **weighted average cost (WAC)**, with `unitCostCents` carried on each
inbound `StockMovement` and `MenuItem.avgCostCents` recomputed on each receipt.
Consumption values at the average in force at the time. The item's average is
written **only** by the receipt path (INV-C4) and never editable by hand.

**Alternatives:** FIFO/lot tracking (more precise, needs lot-level allocation on
every sale and a lot table — the precision does not change a single decision a
bar manager makes); standard cost with periodic revaluation (hides supplier price
creep, which is exactly what the price-change flag exists to expose); last-cost
(simple, and wrong the moment prices move mid-week).

**Consequences:** pour cost and margin are computable from movements alone, with
no join to open lots. A void's stock return (plan 16) must re-enter at the cost
it left at rather than the current average (INV-C5) — the one cross-plan seam,
tested from both sides. Historical margin does not retroactively change when a
new shipment arrives at a different price.

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
   ├─ Cron job handlers (AD-9)     ├─ nightly_rollups (AD-11)
   └─ audit_entries (AD-16) ── written in-transaction with every sensitive effect
```

Append-only ledgers, in one place (AD-16): `stock_movements`, `tab_adjustments`,
`occupancy_events`, `admissions`, `time_entries`, `tip_distributions`,
`commission_statements`, `incident_notes`, `lead_activity`, `chat_messages`,
`broadcasts`, `sold_out_events`, `domain_events`, `audit_entries`.
