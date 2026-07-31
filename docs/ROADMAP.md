# PRODUCT ROADMAP — NightLifeNext

**Strategy:** Business Logic First. Every operational workflow is sketched and
settled on the demo track before it is graduated to live. Production hardening
and delivery automation are the last two phases — automate the delivery of a
complete product, not a work-in-progress.

**Last updated:** 2026-07-30
**Supersedes:** the 2026-07-27 roadmap. This realignment absorbed and retired
six documents whose content now lives here: the business logic audit, the MVP
implementation-gaps report, the TODO audit, the traceability matrix, the UX
review, and the doc change log. `docs/plans/NN-*-PLAN.md` remain the per-feature
implementation guides; `docs/PRD.md`, `docs/ARD.md` and `docs/DDD.md` remain the
requirements, architecture and domain references.

---

## WHERE WE ARE

Phases 1–6 are complete. The product is **feature-complete on the demo track**:
every operational workflow a VIP bottle-service nightclub needs exists as mock
data → mock service → UI, drivable end-to-end in the demo build.

**The live build is behind.** Roughly half the feature surface still throws
`"Not yet supported"` in live mode: eight modules are fully stubbed (door,
waitlist, incidents, guest identity, workforce time/tips/commission, purchasing)
and six more are partially stubbed. **Phase 7 closes that gap** — it is the only
thing standing between today and an MVP a real venue can open its doors on.

| Phase | Scope | Status |
|---|---|---|
| 1 | Core Platform Foundation (plans 01–12) | **Complete** — live |
| 2 | Core Nightclub Operations (plans 13–17, 25–26, S-01→S-04) | **Complete** — demo; live pending Phase 7 |
| 3 | Business Logic Completion (plans 18–20, RV/OE/CRM) | **Complete** — demo; live pending Phase 7 |
| 4 | Automation & Intelligence (AI-01→AI-14, AM-01→AM-13) | **Complete** — live |
| 5 | Mobile Experience: PWA + Push (plan 28) | **Complete** — live |
| 6 | Foundation Modernization & Server State (plan 30 + TanStack Query) | **Complete** |
| **7** | **Live Graduation to MVP** | **← CURRENT** |
| 8 | Production Readiness (plans 31–35) | Not started |
| 9 | CI/CD, Deployment & Release Automation (plan 36) | Not started |

---

## PHASE 1 — CORE PLATFORM FOUNDATION · COMPLETE

Plans 01–12. Postgres + Prisma with integer cents, Better Auth with the
organization plugin, venue/zones/tables, menu/inventory with a movement ledger,
the order core with server-computed fees, guest sessions with signed QR tokens,
SSE realtime over Postgres `LISTEN/NOTIFY`, the analytics and report engine,
platform admin and tenant billing, the Luxe VIP Gold design system, and
containerized local dev.

Everything in this phase is live: real route handlers, real schema, integration
tests against PGlite.

| Plan | Feature |
|------|---------|
| 01 | Foundation: Postgres, Prisma, cents, test infra |
| 02 | Authentication & authorization (Better Auth) |
| 03 | Venue, zones & tables |
| 04 | Menu, inventory & packages |
| 05 | Orders & fees (CORE) |
| 06 | Guest sessions, QR tokens & help |
| 07 | Realtime & floor pulse (SSE + NOTIFY) |
| 08 | Reservations, events & promotions |
| 09 | Analytics & report engine |
| 09b | V1 operational closure (live identity, table lifecycle, venue time) |
| 09c | Analytics depth & reporting expansion |
| 10 | Platform admin & billing |
| 11 | Luxe VIP Gold visual revamp |
| 12 | Containerized local dev |

---

## PHASE 2 — CORE NIGHTCLUB OPERATIONS · COMPLETE (DEMO TRACK)

Plans 13–17 plus the notification dispatch layer (25–26) and the four safety
features. The venue can open its doors: the tab is a financial object, the door
has a surface, guests have identity, incidents are recorded, and notifications
reach staff.

| Plan | Feature | Track status |
|------|---------|--------------|
| 13 | Embedded reservations & reserved-table QR gate (PIN gating, public booking page) | Demo · live pending (WS-3) |
| 14 | Promoters: role, mobile panel & attribution analytics | Demo · live pending (WS-3) |
| 15 | Floor-role capability matrix & security panel | Demo · **live (WS-6)** — server-enforced permissions, nav derived from the matrix |
| 16 | Tab ledger: comp/void/discount with reason codes, minimum spend, transfer/merge/split, shift cash-out, audit trail | Demo · live pending (WS-1) |
| 17 | Door surface, guest profiles, incidents, ejection, safety enforcement | Demo · live pending (WS-2) |
| 25 | Notification dispatch core (Resend email, React Email templates, `NotificationLog`, BullMQ/cron) | **Live** |
| 26 | SMS notifications (Twilio) | **Live** |

**Safety features (S-01→S-04)** — all shipped on the demo track inside plan 17:
age verification with DOB calculation and denied-entry recording (S-01),
mandatory incident reporting with reportable flag and regulatory deadline (S-02),
emergency evacuation mode with headcount ledger (S-03), and certification
tracking with scheduling enforcement (S-04).

---

## PHASE 3 — BUSINESS LOGIC COMPLETION · COMPLETE (DEMO TRACK)

Plans 18–20 plus the ~86 operational features from the business logic audit
(2026-07-29), delivered across five MVP sprints and merged in
`chore/foundation-modernization`.

| Plan | Feature | Track status |
|------|---------|--------------|
| 18 | Workforce: time clock, dated shifts, scheduling, tip pooling, promoter commissions | Demo · live pending (WS-4) |
| 19 | Cost & supply: suppliers, purchase orders, par levels, stocktakes, waste, margin analytics | Demo · live pending (WS-5) |
| 20 | Navigation & UX: grouped nav, command palette, global attention, URL-backed view state, keyboard model, undo-vs-confirm policy | **Live** |

**Feature families delivered** (audit codes retained for traceability; each is
implemented in the mock service for its domain):

- **RV-01→RV-21 — Revenue & guest experience.** Time-slotted and capacity-aware
  reservations, auto-gratuity rules, cover price schedule, order priority
  scoring, pre-order inventory check, delegated comp authority, split-bill,
  deposits, cancellation windows and penalties, hold timers, structured guest
  preferences, celebration detection, guest value scoring, watchlist tier,
  incident history on profile, integrated ejection workflow, pending-session
  timeout, minimum-spend progress alerts, tab spending cap, bar tabs.
- **OE-01→OE-35 — Operational efficiency.** SLA timers and escalation, prep
  ETA, order modification, service-item checklists, round tracking, dual-session
  detection, session reopen, pre-closure itemized review, shift handoff,
  reservation name matching, wristband tracking, VIP expedited entry, re-entry
  cutoff, smoke-break distinction, staggered admission warnings, guest-list
  capacity and bulk import, run sheets, event-scoped menus, late-arrival and
  no-show detection, break compliance, pre-shift briefings, per-shift staff
  metrics, incident escalation, witness/CCTV tracking, medical checklist,
  post-incident action items, supplier performance, inter-zone stock transfer,
  pre-/post-service checklists.
- **CRM-01→CRM-07 — Guest identity.** Staff notes, linked profiles, guest photo,
  spend-by-category, visit cadence, referral tracking, data-deletion workflow.

**Residual demo-track gaps** (three of ~86, all Medium priority — carried to the
parking lot, not blockers): OE-03 batch fulfillment, OE-22 overtime detection
and alerting, OE-26 shift-swap deadline enforcement.

---

## PHASE 4 — AUTOMATION & INTELLIGENCE · COMPLETE

Analytics depth (AI-01→AI-14) is implemented in
`src/features/analytics/analytics-depth.ts` behind `/api/analytics`, and the
automation rule engine (AM-01→AM-13) in `src/features/automation/core.ts`
behind `/api/automations/*` with cron handlers under `/api/jobs/*`.

Shipped: night-over-night comparison, projection engine, per-hour breakdown,
door-to-table conversion funnel, table-turn analytics, SLA/time-to-serve,
comp/void ratio monitoring, CSV export and scheduled email delivery (closing
plan 09/09c's unshipped leg), promoter performance, incident pattern, guest
retention, bottle-service utilization, capacity utilization, and night-summary
auto-generation. Automations: reservation auto-release, suggested purchase
orders from par levels, overdue-order escalation, duplicate-reservation
detection, VIP tier upgrade flags, event-window pricing, event auto-close,
86-board auto-clear, stocktake variance flags, VIP arrival alerts, dormant-VIP
flags, table suggestion by party size.

---

## PHASE 5 — MOBILE EXPERIENCE (PWA + PUSH) · COMPLETE

Plan 28. Service worker at `public/sw.js`, web app manifest at
`src/app/manifest.ts`, app shell in `src/lib/app-shell.tsx`, offline queue in
`src/lib/offline-queue.ts` with command-id idempotency and 24-hour expiry, and
Web Push via `web-push` with VAPID keys behind `/api/push/*`.

PWA-01→PWA-08 and PSH-01→PSH-09 are implemented, and the operational
notification triggers are wired through the single dispatcher
(`src/features/notifications/dispatch.ts`, AD-22) across push, email and SMS
with per-user per-channel preferences, quiet hours, delivery logging and
retry-with-backoff.

---

## PHASE 6 — FOUNDATION MODERNIZATION & SERVER STATE · COMPLETE

Plan 30 plus the TanStack Query adoption that followed it.

**Plan 30** replaced the hand-rolled foundations that had outgrown themselves:
Recharts for `MockChart`, react-hook-form + Zod across 25 forms, dnd-kit for raw
pointer events on the floor map, TanStack Virtual for page-based pagination,
react-day-picker for native date inputs, and BullMQ (with a cron fallback for
local live dev) for the notification queue. It also moved services into
`src/features/{domain}/` bounded contexts and pruned 20 stale `TODO(backend)`
markers.

**TanStack Query adoption** (PR #90) replaced every hand-rolled
`useState` + `useCallback` + `useEffect` fetch loop with `useQuery`/`useMutation`
across the admin, manager, staff, guest, public and subscription surfaces. Query
key builders live in `src/features/{domain}/query-keys.ts`; the provider is
`src/components/providers/query-provider.tsx`. This is now the house pattern for
all client-side reads — a new page fetching in an effect is a pattern break.

---

## PHASE 7 — LIVE GRADUATION TO MVP · CURRENT

**Goal:** every feature that works in the demo build works in the live build,
against real Postgres, with real auth and real tenant scoping. When this phase
closes, the product is an MVP a venue can open on.

**How to read this phase:** each workstream graduates one or more existing plans.
No new plan files — plans 13–19 already carry the data model, the design and the
test requirements for their live track; this table says which stubs to fill and
in what order. Update the plan file in the same PR if you depart from it.

### Workstreams, in dependency order

| WS | Scope | Plan(s) | Stubs to fill | Risk |
|----|-------|---------|---------------|------|
| **WS-1** | **Tab ledger & financial controls.** Adjustment reasons CRUD, comp/void/discount with reason codes, session transfer/merge, split-bill, venue audit trail, shift cash-out with drawer variance, `rushOrder`/`compEntireOrder`/`remakeOrder`/`reportWalkout`. New routes under `/api/tab/*`, `/api/audit`, `/api/cashout`, `/api/orders/{id}/*`. | 16 | `ordering/live-service.ts`, `platform/audit-live-service.ts`, `platform/cashout-live-service.ts`, `guests/live-service.ts` (transfer, split) | **High** — money |
| **WS-2** | **Door, guest identity & safety.** The largest workstream: the entire door module (~20 methods — occupancy, admissions, coat check, evacuation, zone occupancy, group admit, refusals, lost items), waitlist, incidents (~14 methods incl. templates and action items), guest profiles (~15 methods incl. bans, merges, links, referrals, deletion), the remaining guest-session methods (refuse, eject, bar tabs, host assignment, spend velocity, tier benefits, abandoned-session close, notes, force-close), table hold/out-of-service lifecycle, and Pulse attention ack/snooze. New routes under `/api/door/*`, `/api/waitlist/*`, `/api/incidents/*`, `/api/guests/*`. | 17 | `door/live-service.ts`, `door/waitlist-live-service.ts`, `safety/live-service.ts`, `sessions/live-service.ts`, `guests/live-service.ts`, `venue/live-service.ts`, `realtime/pulse-live-service.ts` | **Critical** — safety & compliance |
| **WS-3** | **Hospitality completion.** Public reservation API routes (plan 13 graduation), `markNoShow` (remove the `reservation-core.ts` guard — the Prisma enum already has the value), blackout dates, bump/upgrade, late-arrival grace, event guest status PATCH, event cancellation, talent management, promoter guestlist quota, public events route, promoter attribution filter. | 13, 14, 08 | `hospitality/reservation-live-service.ts`, `hospitality/events-live-service.ts`, `hospitality/events-mock-service.ts` | Med |
| **WS-4** | **Workforce & incentives.** Time tracking (~15 methods: clock in/out, breaks, dated shifts, time off, swaps), tip pool rules and distributions, commission rules and statements, table assignments, shift handoffs, and the shift-reminder scheduled job. New routes under `/api/workforce/*`. | 18 | `workforce/time-live-service.ts`, `workforce/tips-live-service.ts`, `workforce/commission-live-service.ts`, `workforce/staff-live-service.ts` | Med |
| **WS-5** | **Cost, supply & profitability.** The purchasing module (~18 methods: suppliers, POs with unit costs, stocktakes with variance, 86-board, waste, profit targets, event costs, pre-/post-service checklists) and checklist graduation (templates as venue-scoped rows, runs append-only per business date). New routes under `/api/purchasing/*`. | 19 | `platform/purchasing-live-service.ts`, `venue/checklist-mock-service.ts` | Med |
| **WS-6** | **Role permissions — persistence + enforcement (shipped).** `venue_role_permissions` table + delta persistence with an audit entry per change; plus the enforcement half: a `requirePermission()`/`requireStaffContext()` server guard adopted across ~47 route handlers (each `StaffAction` gated at the `"staff"` area with the action as authority), scoped `canDo(perms, role, action, ctx)` for ownership/zone actions, a fail-closed `usePermissions()` hook + `<Can>` replacing the hardcoded `"venue-1"` in 10 pages, and `getStaffNav` derived from the live matrix so nav can't drift. Reservations (dual manager/promoter authority) and config CRUD stay area-only. | 15 | `platform/permission-guard.ts`, `platform/permission-live-service.ts`, `shared/permissions.ts`, `platform/use-permissions.ts` | Med |
| **WS-7** | **Notification residue.** Reservation PIN delivery via email/SMS on confirm, and the `venueName` fix in `/api/reservations/[id]/status` (fetch the org name instead of passing `venueId` as the name). | 25, 26 | `hospitality/reservation-mock-service.ts`, `app/api/reservations/[id]/status/route.ts` | Low |
| **WS-8** | **Schema & type alignment.** `promoterId` FK on Reservation, nullable `photoUrl` column, `"merged"` added to the Prisma `SessionStatus` enum, `isAlcoholic`/`abv`/`allergens` columns on MenuItem, `reservationPin` stamped at seat time, `happyHourSnapshot` attribution column, and replacing the hardcoded `VENUE_ID = "venue-1"` in `app/manager/staff/page.tsx` with the session's venueId. | — (cross-cutting) | `lib/types.ts`, `features/sessions/core.ts`, `features/menu/core.ts` | Low |

WS-8 can proceed incrementally alongside any other workstream. WS-3 through WS-7
can run in parallel once WS-1 lands. WS-2 depends on WS-1 (the ejection workflow
closes a tab) and is the long pole.

```
WS-1 (tab ledger) ─┬─► WS-2 (door/safety) ──► WS-7 (notification residue)
                   ├─► WS-4 (workforce) ──► WS-5 (cost & supply)
                   ├─► WS-3 (hospitality)
                   └─► WS-6 (permissions)
WS-8 (schema/types) ─── incremental, any time
```

### Rules for this phase

- **The mock is the contract.** Every live implementation `satisfies` the mock
  service's type. No mock is edited to ship live behavior, no call site changes,
  no `mockXService → xService` renames (R1, AD-14).
- **Test-first for invariants.** Money math, state machines, ledgers and locks
  get the failing test before the code (AGENTS.md §7b.3). WS-1 is entirely in
  this category.
- **Tenant isolation canary.** Every integration suite for a tenant-owned model
  calls `expectTenantIsolation()`, and every role-gated endpoint gets one
  wrong-role 403 case.
- **A `TODO(backend)` dies in the commit that fulfils it.** A simulation dies in
  the PR that ships its real counterpart.

### Exit criteria

1. `grep -rn "Not yet supported" src/` returns nothing outside intentional
   demo-only stubs.
2. A GM can run a full night end-to-end **in the live build**: door count and
   admissions with age verification, seat a VIP table against its minimum, rush
   and comp a round, close and split the tab, reconcile the drawer, file an
   incident, and distribute tips.
3. A banned guest is blocked at the door; the evacuation workflow is tested.
4. Integration tests cover every new route handler, including tenant isolation
   and wrong-role rejection.
5. Two-context E2E passes: guest scan → order → delivery; manager fee change →
   guest cart reflects it.
6. tsc, eslint, unit + integration suites, E2E, and `next build` green.

---

## PHASE 8 — PRODUCTION READINESS · NOT STARTED

Plans 31–35. No new product features — this phase makes the existing product
production-safe before a real venue signs.

| Plan | Feature | Depends on | Risk |
|------|---------|-----------|------|
| 31 | Security hardening: rate limits, headers, CSP report-only, secrets scan, cookie flags | Phase 7 | Med |
| 32 | Observability: structured logging (pino), error tracking (Sentry), health checks, uptime monitoring | 31 pairs well | Low-Med |
| 33 | Database operations: automated backups, restore drill, connection pooling, index audit | 12, staging DB | Med |
| 34 | i18n: full French/English UI chrome, locale toggle, `guestLocale` on venue, French variants for every notification template | — (35 renders through it) | Med |
| 35 | Compliance & privacy (Law 25 / PIPEDA): consent management, retention policies, deletion paths, breach register, published policy pages | 25, 34; 17 supplies guest/incident data | Med |

**Exit criteria:** Security scan clean. Backup restore drill passed. Health
checks green. French UI complete for guest and public surfaces (ops French can
trail). Published privacy policy and consent management in place. Retention cron
jobs active. Breach response procedure documented and contact-tested.

---

## PHASE 9 — CI/CD, DEPLOYMENT & RELEASE AUTOMATION · NOT STARTED

Plan 36. Intentionally last (AD-23). Automating deploys of an incomplete product
is premature optimization.

| Plan | Feature | Risk |
|------|---------|------|
| 36 | CI/CD pipeline: GitHub Actions, branch protection, lint/typecheck/test/build gates, staging auto-deploy on `dev`, production deploy on `master` with approval gate, database migration automation, rollback rehearsal, deployment audit log, infrastructure-as-code (Coolify config in repo), disaster recovery runbook, production monitoring and alerting, on-call escalation | Low |

**Permitted before Phase 9:** one minimal CI gate on every PR to `dev` —
`npx tsc --noEmit && npx eslint src && npm run test`. That is all. No staging
deploys, no production pipelines, no infrastructure automation.

**Exit criteria:** Full pipeline operational. Staging deploys on merge to `dev`.
Production deploys with approval gate. Rollback rehearsed and documented.
Disaster recovery runbook tested.

---

## PLAN INDEX

Plan numbers are assigned in implementation order at creation time. Plans 01–30
are complete or in live graduation and keep their numbers permanently — source
comments and git history reference them. Plans 31–36 were renumbered in this
realignment so that all *remaining* work is numbered in ROADMAP order.

| Plan | Feature | Phase | Status |
|------|---------|-------|--------|
| 01–12 | Foundation through platform admin & local dev | 1 | Live |
| 13 | Embedded reservations & QR gate | 2 | Demo · WS-3 |
| 14 | Promoters | 2 | Demo · WS-3 |
| 15 | Floor-role capability matrix & security panel | 2 | Demo · **live (WS-6 shipped)** |
| 16 | Tab ledger & adjustments | 2 | Demo · WS-1 |
| 17 | Door, arrival, guest identity & safety | 2 | Demo · WS-2 |
| 18 | Workforce: time, incentives | 3 | Demo · WS-4 |
| 19 | Cost, supply & profitability | 3 | Demo · WS-5 |
| 20 | Navigation & UX overhaul | 3 | Live |
| 25 | Notification core & email (Resend) | 2 | Live |
| 26 | SMS notifications (Twilio) | 2 | Live |
| 28 | PWA & web push | 5 | Live |
| 30 | Foundation modernization | 6 | Live |
| 31 | Security hardening | 8 | Not started |
| 32 | Observability | 8 | Not started |
| 33 | Database operations | 8 | Not started |
| 34 | i18n: French/English | 8 | Not started |
| 35 | Compliance & privacy | 8 | Not started |
| 36 | CI/CD & deployment | 9 | Not started |

### Renumbering map (2026-07-30)

| Old | New | Plan |
|-----|-----|------|
| 22 | **31** | Security hardening |
| 23 | **32** | Observability |
| 24 | **33** | Database operations |
| 27 | **34** | i18n French/English |
| 29 | **35** | Compliance & privacy |
| 21 | **36** | CI/CD & deployment |

**Numbers 21, 22, 23, 24, 27 and 29 are retired and must never be reused.** Old
commits and docs reference them with their old meaning; reusing them would make
git history ambiguous. Numbering restarts at 37 for the next new plan.

---

## PARKING LOT — DEFERRED, RANKED BY NECESSITY

Ranked by how soon the product will hurt without it. Nothing here blocks MVP.

### Tier 1 — first things to pull in after MVP

| # | Deferred | Why deferred / what triggers it |
|---|---|---|
| 1 | **OE-22 overtime detection & alerting** | Quebec labour law makes this a compliance risk once headcount grows. Break compliance (WF-06) shipped; overtime did not. Triggers on the first payroll dispute. |
| 2 | **OE-03 batch fulfillment** | Runners fulfil orders one at a time. Fine at 30 orders/night, painful at 300. Triggers on the first sold-out Saturday. |
| 3 | **OE-26 shift-swap deadline enforcement** | Swap requests exist without a cutoff, so a swap can land 10 minutes before a shift. Triggers on the first no-show caused by a late swap. |
| 4 | **Enforced CSP for scripts** | Plan 31 ships report-only. Next.js's inline runtime makes enforcement its own project. Triggers on a security questionnaire from a customer. |
| 5 | **Redis-backed rate limiting** | In-memory limiter is correct for a single VPS. Triggers on horizontal scaling. |
| 6 | **RLS as defence-in-depth** | Tenant scoping is enforced centrally by a Prisma client extension (AD-3). Triggers on a second engineer or a compliance audit. |

### Tier 2 — earned by growth

| # | Deferred | Why deferred / what triggers it |
|---|---|---|
| 7 | **Multi-venue owner accounts** (cross-venue rollups, shared menus/staff, regional roles) | Triggers on the second venue sign-up from the same owner. |
| 8 | **Metrics timeseries stack** (Prometheus/Grafana/Loki) | Sentry + health checks (plan 32) cover incidents. Triggers on trend-analysis demand. |
| 9 | **Offline mode beyond the Phase 5 action queue** | Full SW caching of application data breaks deploys. The queue + app shell covers door admission and incident filing during brief outages. |
| 10 | **Self-serve DSAR portal** | Law 25 / PIPEDA are covered by the documented procedure in plan 35. Triggers on EU market entry. |
| 11 | **Locales beyond fr/en, RTL** | Plan 34 ships fr/en — the QC market's actual requirement. |
| 12 | **POS/KDS integrations, printer hardware** | No customer demand yet. Earn them. |

### Tier 3 — deliberate product omissions

| # | Deferred | Why |
|---|---|---|
| 13 | **Guest card payments (Stripe Connect)** | Not a deferral — a decision (AD-12). Consumer CC fraud risk with anonymous nightclub guests. The app computes what is owed and never collects it. Tenant SaaS subscription billing is the sole payment integration. |
| 14 | **Native iOS/Android apps** | The PWA (Phase 5) covers the need without two app stores. |
| 15 | **Marketing email/SMS campaigns** | Plans 25–26 are transactional only. CASL consent infrastructure is not built. |
| 16 | **Recipes / BOM / cocktail pour costing** | Product focus is VIP bottle service. Per-bottle WAC (AD-18) covers the actual business. |

**Resolved and removed from this list:** queue infrastructure (BullMQ adopted in
plan 30 for staging/prod, cron fallback for local live dev).

---

## DEFINITION OF DONE — EVERY FEATURE

1. **Demo-track features** (audit codes: RV, OE, CRM, AI, AM, PWA, PSH):
   mock data → mock service → UI, in demo mode, entry points behind
   `isDemoMode()`. Iterate until the UX is settled. Every demo-track feature
   carries a `TODO(backend)` listing what the live implementation needs.
2. **Live graduation** (plan numbers): the plan is followed, or updated in the
   same PR with why. The real service `satisfies` the mock's type. The selector
   is wired. Call sites and the mock are untouched (R1, AD-14). Simulations are
   gated behind `isDemoMode()`. Tests per AGENTS.md §7b.
3. **Verification ladder:** tsc → eslint → unit + integration suites → preview
   drive → build. Green on every merge.
4. **Documentation:** AGENTS.md / PRD / ARD / DDD / ROADMAP edited in the same
   PR if the feature made any of them stale (AGENTS.md §9.9).

---

## RELEASE CADENCE

- **Permanent branches:** `dev` (OVHcloud staging) and `master` (OVHcloud
  production + Vercel demo).
- **Work branches:** branch from `dev`, merge back via PR, delete after merge.
- **Plan-numbered features:** `feature/NN-shortname`.
- **Release PRs:** `dev` → `master` when stable and QA'd on staging. The PR
  description is the release summary.

### Phase 7 runs on an integration branch

Phase 7 is eight workstreams spanning weeks, which is longer than the
short-lived work branch AGENTS.md §10.8 assumes. It runs on one integration
branch instead:

```
feature/ws-1-tab-ledger ──PR──┐
feature/ws-2-door-safety ─PR──┤
feature/ws-3-hospitality ─PR──┼──► feature/live-graduation ──PR──► dev ──► master
feature/ws-4-workforce ───PR──┤       (integration branch)      (staging)  (prod)
… WS-5 … WS-8 ────────────PR──┘
```

- Each workstream branches from `feature/live-graduation` and PRs back into it.
- Rebase a workstream branch onto the integration branch before opening its PR
  if the two have diverged.
- The integration branch never merges into `dev` mid-phase. One release PR
  closes the phase, and its description is the Phase 7 exit-criteria checklist.
- Consequence to accept: staging sees nothing until the phase closes. Verify
  workstreams locally against `npm run dev:pglite`, not on staging.
- The integration branch is deleted when the phase closes. This pattern is for
  Phase 7 only — normal work goes straight to `dev` per AGENTS.md §10.8.
