# PRD — NightLifeNext Backend

Status: Phase 2 shipped through plan 12 (see `docs/ROADMAP.md` for per-feature
status); plan 13 (embedded reservations & QR gate) is demo-complete, live
graduation pending; plans 14–15 (promoters · floor-role capability matrix +
security panel + per-role demo personas) and **plans 16–20, the
operations-completeness wave** (tab ledger · door & guest identity · workforce ·
cost & profitability · navigation/UX overhaul) are planned, demo track first;
plans 21–29 are the production-readiness wave ·
Owner: Eddy · Last updated: 2026-07-26

## 1. What we're building

NightLifeNext is a nightclub-operations platform. The Phase 1 prototype proved
the product across four surfaces with mock data, and Phase 2 has since landed
the real backend behind the same interface — the surfaces below now run on
Postgres in the live build and on the permanent mock sandbox in the demo build:

- **/manager** — venue control room: live pulse, orders, floor map, menu/inventory,
  staff & scheduling, reservations/events/promotions, analytics & reports, settings.
  Plans 16–19 add the tab ledger (adjustments, cash-out, audit), guests & waitlist,
  incidents, tips & commissions, and purchasing/stocktake/profitability.
- **/staff** — mobile floor-crew panel: order dispatch (claim/release), 86-board,
  show-floor lock, approvals, help queue, chat. Plans 17–18 add the **door**
  (occupancy, admissions, ID check, waitlist), incident reporting and the time
  clock.
- **/guest** — QR table ordering: menu, cart with configurable fees, live ETA,
  bottle gifting, tab closure, receipt with bill splitting.
- **/admin** — platform SaaS: lead pipeline, tenant management, provisioning.

Phase 2 replaced the in-memory mock services with a real backend **without changing
the product**. The prototype is the spec for how the product feels (AGENTS.md §9.8);
the backend is invisible to a demo viewer. The migration mechanism is the
selector layer (AD-14): mock and real implementations co-exist permanently.

## 2. Users & jobs

| User | Job to be done |
|---|---|
| Venue manager | Run the night: see problems before guests feel them, control the floor, price the menu, staff the shifts — and know by 04:00 what the night cost, what it made, who worked it and what happened in the room. |
| Host / bartender / runner | Work a loud, dark, busy room from a phone: claim orders, react to 86s and broadcasts, approve tables. Runners are fulfillment assistants (prepare/ready/deliver, zone-scoped help) — they don't accept orders or approve sessions (plan 15). |
| Promoter | Funnel guests in and get judged on it: manage their own reservation book from a phone, watch their tables' orders live (read-only), see only their funnel (plan 14). |
| Security | Keep the room safe: work the door (occupancy against legal capacity, admissions, ID checks, refusals), file incident reports, handle security help requests, their shifts, the security chat channel (plans 15, 17). |
| Host | Seat the room well: know who's walking in and what they're worth, manage the waitlist, approve tabs, hold parties to their minimum spend (plans 16–17). |
| Guest | Order from the booth without flagging anyone down; close out and split the bill without friction. |
| Platform team | Sell, provision and bill venues; keep tenants isolated and healthy. |

## 3. Why a backend now

The prototype's limits are now the product's limits:

1. **Nothing persists** — a reload erases the night. Venues need durable orders,
   inventory ledgers and money records.
2. **Nothing is shared** — two phones can't see the same floor. The whole value
   proposition (dispatch, 86-board, broadcasts, last call) assumes shared live state.
3. **Nothing is protected** — demo auth and an admin password gate stand in for
   real accounts, roles and tenant isolation.
4. **Nothing is billed** — subscriptions are display-only; there is no revenue path.

## 4. Scope

### In scope (Phase 2)

- Durable multi-tenant storage for every domain concept in `src/lib/types.ts`.
- Real authentication and role-based authorization (manager/host/bartender/
  runner/security/promoter — floor-role capabilities centralized in one matrix
  enforced UI- and server-side, plans 14–15; guest table tokens, platform
  admin).
- The full order lifecycle server-side: totals, fees, inventory draw-down,
  state machine, claims, gifts — transactional and correct.
- Live updates replacing every `setInterval` poll (orders, pulse, chat, 86-board,
  broadcasts, last call, show lock, approvals).
- Analytics computed from real orders; report engine with scheduled runs + email.
- Platform admin: leads, tenant CRUD, provisioning job, Stripe subscription billing.
- Test suite per AGENTS.md §7 Phase 2 (money/state machines first, route-handler
  integration tests, a handful of Playwright E2E flows).
- **Operations completeness (plans 16–20)** — the domain gaps found in
  `docs/BUSINESS-LOGIC-GAP-REVIEW.md` and the navigation gaps in
  `docs/UX-REVIEW.md`: the tab as a financial object (minimum spend, void/comp/
  discount with reason codes, transfer/merge/split, shift cash-out, venue audit
  trail); the door (occupancy, admissions, waitlist, unified check-in, ID-check
  record, coat check); guest identity (VIP recognition, ban list, no-show,
  consent); safety (incident reports, refusal of service, responsible-service
  drink counts); workforce (time clock, dated shifts, swaps/time-off, coverage
  warnings, tip pooling, promoter commission); cost & supply (suppliers, purchase
  orders with unit costs, par levels, stocktake variance, waste, by-the-pour) and
  the profitability layer built on it; and a rebuilt navigation model (grouped
  nav, ⌘K palette, global attention, URL-backed view state, keyboard, undo).
- **The mock-powered Live Demo remains a shipped product surface** (AD-14): the
  landing page keeps linking to a fully working demo that needs no accounts and
  resets itself per visitor. Mocks are maintained, not retired.

### Out of scope (Phase 2)

- **Guest payment processing** (charging cards for orders). Tabs settle outside the
  app, as today. Stripe is used for *SaaS subscriptions only*. Guest payments are a
  Phase 3 flagship (Stripe Connect).
- Native mobile apps, offline mode, printer/KDS hardware integrations.
- **Multi-venue single-account management** (enterprise "groups": cross-venue
  rollups, shared menus/staff, regional-manager roles) — explicitly deferred out
  of the 16–20 wave; the data model allows it later. `/admin` remains the only
  cross-tenant surface.
- **Paying anyone.** Plans 16–19 compute and record money that is owed — tab
  balances, tip shares, commission statements, purchase-order totals, cover
  amounts. None of it moves funds; settlement stays outside the app, consistent
  with the guest-payments omission above.
- POS integrations (Toast/Square import) — explicitly not our wedge; see brainstorm
  decision: we are nightly floor operations, not back-office.

## 5. Product requirements

Numbered for traceability from plans and tests (`Rn`).

**R1 — Contract stability.** Every page keeps calling the same service interface.
The mock defines the contract (`type XService = typeof mockXService`); the real
implementation must satisfy it, and pages import through the `src/lib/services/`
selector (AD-14). Mock and real implementations co-exist permanently — the mocks
power the public Live Demo.

**R2 — Tenant isolation.** No query returns another venue's rows, enforced
centrally, not per-handler. `/admin` is the sole cross-tenant surface, behind a
platform role. A staff token must never reach manager endpoints.

**R3 — Money correctness.** Order totals, fee breakdowns (multiple percentage/flat
fees), tips and splits are computed server-side, stored in integer cents, and always
sum exactly. The client never computes a price the server trusts.

**R4 — Inventory truth.** `item.inventory === Σ movements.delta` at all times;
sales decrement inside the order transaction; sell-outs emit 86 events.

**R5 — State machines hold.** Orders follow pending → accepted → preparing → ready
→ delivered (or cancelled); sessions follow pending → approved/denied →
closure-requested → closed. Illegal transitions are rejected server-side.

**R6 — Live floor.** A change made on one device (order status, claim, 86,
broadcast, last call, show lock, approval) is visible on every other relevant
device within 2 seconds without a manual refresh.

**R7 — Real accounts.** In the live build: staff sign in with real credentials;
managers invite staff by email; guests join via signed, revocable table QR tokens;
the platform team has real admin accounts. Phase 1 simulations ("Simulate host
approval", `CURRENT_STAFF_ID`, localStorage gates) are **demo-gated behind
`isDemoMode()`** in the same PR that ships their real counterpart (AD-14) — live
paths never see them, the Live Demo keeps them.

**R8 — Analytics from truth.** Dashboard/analytics/report numbers derive from real
orders and movements — no seeded generators in production paths.

**R9 — Billing.** Tenants subscribe to a plan via Stripe; plan limits (tables,
staff) are enforced; trial → active conversion, suspension and cancellation work
end-to-end with webhooks.

**R10 — UX invariants don't regress** (AGENTS.md §9.8): confirmation dialogs,
loading skeletons (real latency replaces `delay()`), empty states, toasts, entity
cross-links, deterministic money display, print styles.

**R11 — Every money mutation is attributable and append-only.** Voids, comps,
discounts, tip distributions, commission statements, stock receipts, waste and
stocktake corrections are ledger rows with an author and a reason; corrections
are new rows, never edits. Every action flagged `sensitive` writes an
`AuditEntry` in the same transaction as its effect.

**R12 — Occupancy and safety records are first-class.** Live occupancy is a
counter fed by an append-only event ledger (never inferred from table state) and
is checked against the venue's legal capacity; refusals, ejections and incidents
are recorded, timestamped and attributed. A banned guest cannot be admitted
without an audited manager override.

**R13 — Guest identity is opt-in.** A `GuestProfile` exists only where a guest
gave identity (reservation, guestlist, door ID check, host tag). The anonymous
QR path stays anonymous (PRD §7). ID checks record that a check happened — never
a document image or number. Marketing consent is captured explicitly and is
per-channel.

**R14 — Every revenue number has a cost counterpart.** Product cost (weighted
average, from receipted purchase orders) and labour cost (from clocked time)
flow into the same aggregations as revenue, so pour cost, gross margin, labour
percentage and per-night contribution are derivable — and targets on them can
raise alerts.

## 6. Success criteria

- A GM can run a full night end to end in the demo: door count and admissions,
  seat a VIP table against its minimum, comp a round, clock the crew in and out,
  close the tab, reconcile the drawer, split the tips, and read one line that
  says what the night made. No step requires a developer or a spreadsheet.
- The 5-minute walkthrough exists in both modes (AD-14): the demo build's `/demo`
  tour runs it on the sandbox, and the live build proves the same night flow with
  two simultaneous authenticated contexts — one staff, one guest — with state
  syncing over live events (the plan-09b two-context E2E).
- A brand-new tenant can be provisioned from admin, receive the manager invite,
  complete onboarding, configure the venue, and take its first guest order without
  developer involvement.
- `npx tsc --noEmit`, the full test suite, and `npx next build` are green on every
  merge; money/state-machine tests exist before their features merge (AGENTS.md §7).
- Zero cross-tenant data leaks under integration tests that explicitly attempt them.

## 7. Non-functional requirements

- **Latency:** interactive reads p95 < 300 ms; order submission p95 < 800 ms.
- **Realtime:** propagation < 2 s (R6); graceful fallback to polling if the live
  channel drops.
- **Availability:** single-region managed infra is acceptable; nightly-ops product
  ⇒ peak load is Fri/Sat 22:00–04:00 venue-local; deploys avoid those windows.
- **Data:** daily backups; soft-delete for money-adjacent records (orders,
  movements); append-only ledgers never mutate.
- **Privacy:** guests are pseudonymous (first name only); no guest PII beyond the
  optional receipt email, which is not stored after send.

## 8. Rollout

Service-by-service behind the stable interface (AGENTS.md §9.4): foundation → auth
→ venue/zones/tables → menu/inventory → orders+fees → sessions/help → realtime →
reservations/events/promotions → analytics/reports → platform/billing. Each step
ships independently; the app runs mixed (some services real, some mock) throughout.
See `docs/ROADMAP.md`.

## 9. Feature lifecycle after the migration

The Live Demo is the permanent sandbox (AD-14): every future feature is sketched
mock-first in demo mode, iterated on UX until satisfied, kept demo-only behind
`isDemoMode()`, and only then given a backend plan (`docs/plans/NN-…-PLAN.md`) and
a real implementation. UI exploration and backend delivery are two tracks that
meet at graduation — see the roadmap's "Ongoing" section.
