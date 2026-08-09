# PRD — NightLifeNext

**Status:** Living document. The product is feature-complete on the demo track
(ROADMAP Phases 1–6). Live graduation is in progress (Phase 7), followed by
production readiness (Phase 8) and CI/CD (Phase 9).
**Owner:** Eddy · **Last updated:** 2026-07-30

---

## 1. What we're building

NightLifeNext is a nightclub-operations platform. It runs every operational
workflow a nightclub needs — from door admissions through table service to
closing reconciliation — across four surfaces, delivered as a Progressive Web App
with push notifications for real-time staff alerts.

### Surfaces

- **/manager** — Venue control room: live pulse, orders, floor map, menu/inventory,
  staff & scheduling, reservations/events/promotions, guests & CRM, incidents,
  analytics & reports, purchasing & costs, settings.
- **/staff** — Mobile floor-crew PWA: order dispatch (claim/release), door
  (occupancy, admissions, waitlist, ID checks, coat check), approvals,
  incident reporting, help queue, chat, time clock, schedule.
- **/guest** — QR table ordering PWA: menu, cart with configurable fees, bottle
  gifting, tab closure, help requests, push notifications for order status.
- **/admin** — Platform SaaS: lead pipeline, tenant management, provisioning,
  plan configuration.

### Dual-mode architecture (AD-14)

The platform runs in two permanent modes:

- **Demo build** (`NEXT_PUBLIC_APP_MODE=demo`): stateless in-memory mock services,
  shipped forever as the public Live Demo sandbox. Deployed to Vercel.
- **Live build** (`NEXT_PUBLIC_APP_MODE=live`): real Postgres backend, auth, live
  events. Deployed to OVHcloud (Beauharnois, QC) via Coolify.

Every feature is sketched mock-first in demo mode, iterated until UX settled, then
graduated to live behind the selector layer. The mocks are never retired.

---

## 2. Users & jobs

| User | Job to be done |
|---|---|
| **Venue Manager / GM** | Run the night: see problems before guests feel them, control the floor, price the menu, staff the shifts, recognise VIPs, handle incidents, and know by close what the night cost and what it made. |
| **Floor Manager** | Oversee zones, approve comps up to threshold, handle guest disputes, manage table turns. (Sub-specialization of manager with venue-configurable comp threshold delegation.) |
| **Host** | Seat the room: know who's walking in, manage the waitlist, approve tabs, enforce minimum spend, recognize regulars and VIPs. |
| **VIP Host** | Manage high-value guest relationships: know preferences, handle bookings, greet personally, upsell bottle packages, track celebrations. (Sub-specialization of host with VIP-tier guest-profile write access and promoter-like booking capabilities.) |
| **Bartender / Bar Lead** | Work the bar queue, manage 86-board in real time, track pour costs, handle stock levels. Bar Lead additionally has inventory cost visibility and purchasing draft capabilities (sub-specialization of bartender). |
| **Runner** | Fulfill orders: claim, prepare, deliver. Fulfillment-only assistant (plan 15). |
| **Promoter** | Funnel guests: manage own reservation book from a mobile PWA, see table spend, receive push notifications on guest arrivals, get performance reports and commission statements. |
| **Security / Security Lead** | Keep the room safe: work the door (occupancy against legal capacity, ID checks, age verification, refusals, watchlist alerts), file incident reports, handle ejections, coordinate evacuations. Security Lead additionally has incident-read-all, incident-mark-reportable, and emergency-evacuate capabilities. |
| **Door Host** | Admit guests: ID checks, cover charge recording, reservation matching, wristband tracking, waitlist management. (Sub-specialization of security with door:admit and door:id-check scope, without incident-read-all access.) |
| **Guest** | Order from the booth via QR without flagging anyone down. Close out and split the bill. Receive push notifications for order status, table-ready alerts, and reservation reminders. |
| **Platform Team** | Sell, provision and bill venues for their SaaS subscriptions; keep tenants isolated and healthy. |

**Role model:** Seven base roles (manager, host, bartender, runner, security,
promoter, platform-admin) drive authN/authZ. Five sub-role specializations
(Floor Manager, VIP Host, Bar Lead, Security Lead, Door Host) are defined in
the capability matrix as permission sets on the base roles — they are not
separate auth roles. Floor Manager and VIP Host share the `manager` and `host`
base roles respectively with elevated scoped capabilities.

---

## 3. Product phases

### Phase 1 — Core Platform Foundation (plans 01–12) · COMPLETE

Durable multi-tenant storage, real auth, full order lifecycle, realtime floor
pulse, analytics, platform admin, design system, containerized local dev. All
live.

### Phase 2 — Core Nightclub Operations (plans 13–17, 25–26) · COMPLETE (DEMO)

The venue can open its doors. Tab ledger (comp/void/discount, minimum spend,
cash-out, audit), door surface (occupancy, admissions, waitlist, ID checks, coat
check), guest identity (profiles, VIP, bans, watchlist), incidents (8 types,
notes, review), safety enforcement (age verification, emergency evacuation,
certification tracking, mandatory incident reporting), and notification
infrastructure. Notifications are live; the rest awaits graduation in Phase 7.

### Phase 3 — Business Logic Completion (plans 18–20) · COMPLETE (DEMO)

~86 operational features from the business logic audit. Workforce (time clock,
scheduling, tips, commissions), cost & supply (suppliers, POs, stocktakes,
margin), the navigation and UX overhaul, plus time-slotted and capacity-aware
reservations, auto-gratuity rules, order priority, cover price schedules, guest
preferences, celebration detection, split-bill, delegated comp authority,
watchlist, and the integrated ejection workflow. Navigation is live; the rest
awaits graduation in Phase 7.

### Phase 4 — Automation & Intelligence · COMPLETE

Night-over-night comparison, forecasting, per-hour analytics, conversion funnel,
SLA analytics, comp/void ratio monitoring, CSV export with scheduled email
delivery, and thirteen automations. All live.

### Phase 5 — Mobile Experience (PWA + Push) · COMPLETE

Installable PWA with app shell, offline indicator and action queue, responsive
mobile-first layouts. Full push system: Web Push API, per-user per-channel
preferences, event-driven dispatch, operational triggers, quiet hours, delivery
tracking and retry policies. All live.

### Phase 6 — Foundation Modernization & Server State · COMPLETE

Plan 30 (Recharts, react-hook-form, dnd-kit, TanStack Virtual, react-day-picker,
BullMQ, feature-folder reorganization) plus TanStack Query as the client
server-state layer (AD-24). All live.

### Phase 7 — Live Graduation to MVP · CURRENT

Everything that works in the demo build works in the live build. Eight fully
stubbed live-service modules and six partially stubbed ones are implemented
against real Postgres with real auth and tenant scoping, in eight workstreams
ordered by dependency. **This is the last phase before MVP.**

### Phase 8 — Production Readiness (plans 31–35) · NOT STARTED

Security hardening, observability, automated backups, French/English i18n,
Law 25 / PIPEDA compliance. No new product features — hardening and compliance
only.

### Phase 9 — Test Coverage Reinforcement & CI/CD (plans 37, 36) · DEFERRED

Plan 37 (test coverage reinforcement) lands first: scoped coverage thresholds
on the live track, per-file floors on money math, the missing admin-provision
E2E flow — the gate plan 36's pipeline enforces. Then automated build/deploy
pipelines, blue-green deployment, infrastructure-as-code, database migration
automation, disaster recovery runbook, production monitoring.
**Intentionally last** — automate delivery of a complete product, not a
work-in-progress.

---

## 4. Scope

### In scope

- Durable multi-tenant storage for every domain concept.
- Real authentication and role-based authorization (7 floor roles + platform admin).
- Full order lifecycle server-side (place → claim → prepare → deliver, with
  priority system, SLA tracking, and ETA calculation).
- Tab ledger: comp/void/discount with reason codes, transfers, merges, split-bill,
  auto-gratuity rules, delegated comp authority.
- Door surface: live occupancy, admissions, ID checks with age verification,
  denied-entry recording, waitlist, coat check, cover price schedule.
- Guest identity: profiles with preferences, VIP tiers, ban/watchlist, celebration
  tracking, visit history, RFM scoring, linked profiles, staff notes, guest photo.
- Incident reports: 8 types, 3 severities, immutable narrative, notes, escalation
  workflow, witness/CCTV tracking, mandatory-reporting compliance, ejection
  workflow integrated with door and tab closure.
- Reservations: time-slotted, capacity-aware, deposit model, cancellation windows,
  hold timers, VIP table gating, recurring templates.
- Events: guest-list capacity enforcement, promoter allocation, bulk import, run
  sheets, event-specific menus/pricing.
- Workforce: time clock with overtime/late-arrival/no-show detection, dated shift
  instances, scheduling with swap/time-off, certification tracking, staffing
  minimum enforcement, tip pooling, promoter commissions.
- Cost & supply: suppliers, purchase orders with cost tracking, auto-suggested
  reorder, stocktakes with variance, waste tracking by reason, pour cost, margin
  analytics.
- Progressive Web App: installable, app shell, offline action queue, responsive
  mobile-first experience.
- Push notification system: Web Push API, per-user preferences, role-based routing,
  event-driven engine, 20 operational triggers, delivery tracking, quiet hours.
- Notification dispatch: Resend (email), Twilio (SMS), push (Phase 5).
- Analytics: 15 metric sections, night-over-night comparison, forecasting,
  conversion funnels, SLA analytics, CSV export + scheduled email delivery.
- Platform admin: leads, tenant CRUD, provisioning, SaaS subscription billing (tenant plans only — no guest or venue payment processing).
- Test suite (AGENTS.md §7b).
- Live Demo — permanent, self-resetting sandbox (AD-14).

### Out of scope

- **Guest or venue payment processing of any kind.** The app computes what is
  owed (order totals, tips, auto-gratuity, cover charges, deposit amounts,
  commission statements, PO totals). Settlement, payment collection, and
  tip distribution happen outside the app. Stripe is used exclusively for
  platform SaaS tenant subscription billing — never for guest payments, venue
  transactions, or deposit processing.
- **Native iOS/Android apps.** PWA (Phase 5) covers the need.
- **POS/KDS integrations, printer hardware.** Earned by customer demand.
- **Multi-venue owner accounts** (cross-venue rollups, shared staff/menus).
  Deferred — triggers on second venue sign-up from same owner.
- **Paying anyone.** Tip shares, commission statements, PO totals are computed
  and recorded; settlement stays outside the app.
- **Marketing campaigns.** Plans 25–26 are transactional only.
- **Recipes / BOM / cocktail pour costing.** The product is VIP bottle service;
  per-bottle weighted average cost (AD-18) covers the actual business.

---

## 5. Product requirements

Numbered for traceability (`Rn`). Extended from the original 14.

**R1 — Contract stability.** Every page calls the same service interface. Mock
defines the contract; real implementation satisfies it; pages import through the
`src/features/{domain}/services.ts` selector (AD-14), read through TanStack Query
(AD-24). Mocks co-exist permanently.

**R2 — Tenant isolation.** No query returns another venue's rows. Enforced
centrally via scoped Prisma client. `/admin` is the sole cross-tenant surface
behind a platform role.

**R3 — Money correctness.** Order totals, fee breakdowns, tips, splits, auto-gratuity,
comp/void/discount amounts — all server-computed in integer cents, always sum exactly.

**R4 — Inventory truth.** `item.inventory === Σ movements.delta` at all times. Sales
decrement inside the order transaction. Waste, transfers, and stocktake corrections
are distinct movement types.

**R5 — State machines hold.** Orders, sessions, reservations, incidents, shifts, POs,
stocktakes — every domain object with a status follows a defined state machine.
Illegal transitions rejected server-side.

**R6 — Live floor.** Changes visible on every relevant device within 2 seconds via
SSE (live mode) or polling fallback (demo mode).

**R7 — Real accounts.** Live build: staff sign in with real credentials; managers
invite staff by email; guests join via signed table QR tokens. Demo simulations
gated behind `isDemoMode()`.

**R8 — Analytics from truth.** Dashboard/analytics numbers derive from real orders
and movements — no seeded generators in live paths.

**R9 — Tenant billing.** Tenants subscribe via Stripe for SaaS plan billing.
Guest order settlement stays outside the app. Stripe is used exclusively for
tenant subscription management, never for guest or venue payment processing.

**R10 — UX invariants.** Confirmation dialogs, loading skeletons, empty states,
toasts, entity cross-links, deterministic money display, print styles preserved.

**R11 — Every money mutation is attributable and append-only.** Every void, comp,
discount, tip distribution, commission statement, and stock receipt is a ledger
row with an author and reason. Corrections are new rows, never edits.

**R12 — Occupancy and safety are first-class.** Live occupancy is an append-only
event counter, never inferred from table state. Age verification is enforced at
admission. A banned guest cannot be admitted without an audited manager override.
Emergency evacuation mode exists and is tested.

**R13 — Guest identity is opt-in.** Profiles exist only where identity was given.
Anonymous QR path stays anonymous. ID checks record that a check occurred — never
a document image or number. Marketing consent is per-channel and explicit.

**R14 — Every revenue number has a cost counterpart.** Product cost (weighted
average from receipted POs) and labour cost (from clocked time) flow into the
same aggregations as revenue. Pour cost, gross margin, labour percentage, and
per-night contribution are derivable.

**R15 — Notifications are event-driven and preference-respecting.** Every
operational notification is triggered by a domain event, routed through a
notification dispatcher, and delivered only to opted-in channels per user per
event type. Never send a push notification to someone who disabled push.

**R16 — Mobile is the primary staff interface.** Every staff surface is
responsive, thumb-reachable, and installable as a PWA. The desktop manager
experience is secondary to the mobile/tablet staff experience.

**R17 — Offline resilience is graceful.** Loss of connectivity shows an indicator
and queues actions locally. When connectivity restores, queued actions sync.
Critical flows (door admission, incident filing) must function during brief
outages.

**R18 — Every cross-module workflow is a single action.** Ejection, guest arrival,
no-show, last-call-to-close — multi-step workflows that span domains are
orchestrated as one atomic action with automatic consequences, not manual
multi-page processes.

---

## 6. Success criteria

- A GM can run a full night end-to-end in the live build: door to close,
  including age verification, VIP recognition, table minimum enforcement,
  comp with reason code, split-bill settlement, incident filing, shift cash-out,
  tip distribution, and night summary report. No step requires a developer or
  a spreadsheet.
- The PWA is installed on staff devices. Staff receive push notifications for
  order assignments, help requests, capacity alerts, and shift reminders.
- A guest scans a QR code, browses a menu in their language, places an order,
  sees an ETA, tracks delivery, splits the bill, and requests tab closure —
  entirely from their phone.
- A promoter manages their reservation book from their phone, sees live table
  spend, receives push on guest arrivals, and gets a commission statement after
  the event.
- Security files an incident, the ejection workflow triggers (tab closed, profile
  banned, door notified) in one action, and the mandatory-reporting deadline is
  tracked with an alert.
- `npx tsc --noEmit`, the full test suite, and `npx next build` are green on
  every merge.
- Zero cross-tenant data leaks under integration tests that explicitly attempt
  them.
- The PWA Lighthouse score ≥ 90 for performance, accessibility, and PWA criteria.

---

## 7. Non-functional requirements

- **Latency:** interactive reads p95 < 300 ms; order submission p95 < 800 ms.
- **Realtime:** SSE propagation < 2 s (R6); graceful fallback to polling if SSE drops.
- **Push latency:** push notification delivery < 3 s from triggering event in
  production.
- **Availability:** peak load Fri/Sat 22:00–04:00 venue-local. Deploys avoid
  those windows. PWA offline queue buffers actions during brief outages.
- **Data:** daily backups with monthly restore drills. Soft-delete for money-adjacent
  records. Append-only ledgers never mutate.
- **Privacy:** guests are pseudonymous (first name only) by default. Guest PII only
  when identity is explicitly given. No document images stored. Law 25/PIPEDA
  compliance (plan 35).
- **Performance:** PWA initial load < 3 s on 4G. App shell cached for instant
  subsequent loads. Service Worker size < 100 KB.

---

## 8. Rollout

Service-by-service behind the stable interface. Foundation → auth → venue →
menu/inventory → orders → sessions → realtime → reservations/events → analytics →
platform admin → tab ledger → door & guests → workforce → cost & supply →
navigation → safety features → operational features → analytics depth →
automations → notifications → PWA → push → foundation modernization →
**live graduation** → security hardening → observability → DB ops → i18n →
compliance → CI/CD.

Everything through "foundation modernization" has shipped. Live graduation
(Phase 7) is in progress.

Each feature ships independently; the app runs mixed (some services real, some mock)
throughout. See `docs/ROADMAP.md` for phase-level sequencing.

---

## 9. Feature lifecycle

The Live Demo is the permanent sandbox (AD-14). Every future feature is sketched
mock-first in demo mode, iterated on UX until satisfied, kept demo-only behind
`isDemoMode()`, and only then given a plan and real implementation. Plan numbers
are assigned in implementation order at creation time; the next new plan is 37
(21–24, 27 and 29 are retired numbers — see the ROADMAP plan index).
Demo track and live track are two tracks that meet at graduation — see
`docs/ROADMAP.md` "Definition of done."
