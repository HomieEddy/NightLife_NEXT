# PRODUCT ROADMAP — NightLifeNext

**Strategy:** Business Logic First. Operational workflows complete before
infrastructure automation. PWA + Push Notifications are first-class delivery
targets. CI/CD and deployment automation are deferred until the product is
functionally complete.

**Last updated:** 2026-07-27
**Supersedes:** prior backend-implementation roadmap (2026-07-26). This
document now governs all product planning; `docs/plans/` remain the per-feature
implementation guides.

---

## Phase 1 — Core Platform Foundation (PLANS 01–15, 13 GRADUATION)

**Status: plans 01–12 COMPLETE · plan 13 demo-complete · plans 14–15 in demo track**

The platform must exist before it can operate a nightclub. This phase delivers
the database, auth, venue config, menu/inventory, orders, realtime floor pulse,
analytics, platform admin, and the first two role-specialisation features.

| Plan | Feature | Status | Risk |
|------|---------|--------|------|
| 01 | Foundation: Postgres, Prisma, cents, test infra | **Complete** | Low |
| 02 | Authentication & authorization (Better Auth) | **Complete** | Med |
| 03 | Venue, zones & tables | **Complete** | Low |
| 04 | Menu, inventory & packages | **Complete** | Med |
| 05 | Orders & fees (CORE) | **Complete** | High |
| 06 | Guest sessions, QR tokens & help | **Complete** | Med |
| 07 | Realtime & floor pulse (SSE + NOTIFY) | **Complete** | Med |
| 08 | Reservations, events & promotions | **Complete** | Low |
| 09 | Analytics & report engine | **Complete** | Med |
| 09b | V1 operational closure (live identity, table lifecycle, venue time) | **Complete** | Med |
| 09c | Analytics depth & reporting expansion | **Complete** | Low-Med |
| 10 | Platform admin & billing | **Complete** | Med |
| 11 | Luxe VIP Gold visual revamp | **Complete** | Low |
| 12 | Containerized local dev | **Complete** | Low |
| 13 | Embedded reservations & QR gate (PIN gating, public booking page) | Demo-complete, live graduation pending | Low |
| 14 | Promoters: role, mobile panel & attribution analytics | Demo track | Med |
| 15 | Floor-role capability matrix & security panel | Demo track | Med |

**Phase boundaries:** The product after Phase 1 has a full ordering core, realtime
floor coordination, analytics, and platform administration. It is feature-complete
for a demo but missing the operational workflows required to run a real nightclub.

**Exit criteria:** Plans 13–15 graduated to live (demo track → full implementation
behind the selector). Two-context E2E test passing. All 15 plans green on tsc,
eslint, suite, and build.

---

## Phase 2 — Core Nightclub Operations (PLANS 16–17 + 25–26 + SAFETY FEATURES)

**Status: not started. Demo track first (AD-14).**

The venue can actually open its doors: the tab becomes a financial object, the door
has a surface, guests have identity, incidents are recorded, and staff/guests
receive notifications. This phase closes the "can't run a real nightclub" gap.

### Tab as a Financial Object (Plan 16)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 16 | Tab ledger: comp/void/discount with reason codes, minimum spend enforcement + progress, session transfer/merge/split, shift cash-out, venue-wide audit trail | 05, 06, 09b, 15 | **High** |

### Door, Guest Identity & Safety (Plan 17)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 17 | Door surface: occupancy counter, admissions, waitlist, ID checks, coat check. Guest profiles (VIP/ban/watchlist, preferences, consent). Incident reports (8 types, 3 severities, notes, review). Ejection workflow. Safety enforcement: age verification (S-01), mandatory-report compliance (S-02), emergency evacuation (S-03), certification tracking (S-04), legal capacity enforcement. | 08, 13, 15, 16 | **Critical** |

### Safety Features (NEW — from business logic audit)

| Code | Feature | Depends on | Priority |
|------|---------|-----------|----------|
| S-01 | Age verification enforcement (DOB calc, legal drinking age config, denied-entry recording) | 17 | **Critical** |
| S-02 | Mandatory incident reporting compliance (reportable flag, regulatory deadline, authority reference) | 17 | **Critical** |
| S-03 | Emergency evacuation mode (zero occupancy, emergency broadcast, headcount ledger) | 17, 07 | **Critical** |
| S-04 | Certification tracking & scheduling enforcement (type, expiry, renewals) | 17 | **Critical** |

### Notification Infrastructure (Plans 25–26)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 25 | Notification dispatch core (Resend email, React Email templates, cron job handlers, `NotificationLog`) | 02, 08, 09/09c, 13 | Med |
| 26 | SMS notifications (Twilio — reservation PIN delivery, waitlist alerts, staff invites) | 25 | Low-Med |

**Why notifications land in Phase 2, not Phase 6:** Plans 25–26 are *product infrastructure*, not *operations infrastructure*. Every feature in Phases 3–5 needs to notify someone — without the dispatch layer, half the roadmap is read-only data with no action. The deferral of CI/CD (Phase 7) does NOT apply to notification infrastructure; the dispatch core is a functional requirement.

**Exit criteria:** A GM can run a full night end-to-end in the live build: door count
and admissions, seat a VIP table against its minimum, comp a round, close the tab,
reconcile the drawer, and file an incident. Staff receive email/SMS for schedule
changes and alerts. Banned guests are blocked at the door. Age verification is
enforced. The evacuation workflow is tested. All Phase 1 plans graduated.

---

## Phase 3 — Business Logic Completion (PLANS 18–20 + 86 OPERATIONAL FEATURES)

**Status: not started. Demo track first (AD-14).**

Every gap from the comprehensive business logic audit (2026-07-27) is addressed.
The product becomes operationally complete for a single-venue nightclub.

### Workforce & Incentives (Plan 18)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 18 | Workforce: time clock, dated shifts, scheduling (publish/swap/cover/time-off/no-show), tip pooling & distribution, promoter commissions | 09b, 14, 15, 16 | Med |

### Cost, Supply & Profitability (Plan 19)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 19 | Cost & supply: suppliers, purchase orders with unit costs, par levels + reorder alerts, stocktakes with variance, waste tracking, by-the-pour costing, margin analytics | 04, 09/09c, 16, 18 | Med |

### Navigation & UX Overhaul (Plan 20)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 20 | Navigation & UX: grouped nav, command palette, global attention, URL-backed view state, keyboard model, undo vs confirm policy, breadcrumbs | — (pairs with 16–19) | Low |

### Revenue & Guest Experience Features (NEW)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| RV-01 | Time-slotted reservations (arrivalTime, duration, overlap enforcement) | **Critical** | Medium |
| RV-02 | Capacity-aware booking (check reservations vs legal capacity) | **Critical** | Medium |
| RV-03 | Auto-gratuity rules engine (party size, zone, table minimum triggers) | **Critical** | Medium |
| RV-04 | Cover price schedule engine (time/event/category-based pricing rules) | High | Medium |
| RV-05 | Order priority system (zone, minimum spend, session age, order type scoring) | **Critical** | Medium |
| RV-06 | Pre-order inventory availability check | High | Small |
| RV-07 | Delegated comp authority (per-role threshold, auto-approve below threshold) | High | Small |
| RV-08 | Split-bill workflow (per-item assignment, sub-total views, sequential settlement) | High | Large |
| RV-09 | Deposit model (amount, status, enforce-before-confirm workflow) | High | Small |
| RV-10 | Cancellation window & penalty (configurable hours, auto-flag, deposit forfeit) | High | Small |
| RV-11 | Reservation hold timer (auto-release expired holds) | High | Small |
| RV-12 | Guest preferences (structured: table, drink, dietary, allergies, celebrations) | **Critical** | Medium |
| RV-13 | Celebration detection (birthday/anniversary date, auto-flag at every touchpoint) | High | Small |
| RV-14 | Guest value scoring / RFM (recency, frequency, monetary; auto-tier suggestion) | Medium | Medium |
| RV-15 | Watchlist tier (separate from ban — alert at admission, don't block) | High | Small |
| RV-16 | Incident history on guest profile view (inline, not separate page) | High | Small |
| RV-17 | Ejection-to-door integrated workflow (one action: close tab + ban + notify door) | **Critical** | Medium |
| RV-18 | Pending session auto-timeout (configurable, auto-reject ghost sessions) | High | Small |
| RV-19 | Minimum-spend progress alerts (nudge staff at configurable checkpoints) | High | Small |
| RV-20 | Tab spending cap (per-session limit, manager-overrideable) | Medium | Small |
| RV-21 | Bar tab support (non-table sessions, bartender-created, profile-linked) | Medium | Medium |

### Operational Efficiency Features (NEW)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| OE-01 | Order SLA timer & escalation (per-order deadlines, Pulse escalation, manager alerts) | High | Small |
| OE-02 | Drink preparation ETA (queue position × avg prep time, guest-visible countdown) | High | Medium |
| OE-03 | Batch fulfillment (multi-select orders, same-table auto-grouping) | Medium | Small |
| OE-04 | Order modification for pending orders (add/remove items, change modifiers) | Medium | Medium |
| OE-05 | Service items checklist on bottle orders (ice, glasses, mixers, garnish) | Medium | Small |
| OE-06 | Round tracking per session (counter, responsible-service flag at threshold) | Medium | Small |
| OE-07 | Dual session detection (two phones, same table — auto-flag) | Medium | Small |
| OE-08 | Session reopen capability (configurable window after close) | Medium | Small |
| OE-09 | Pre-closure itemized review (line-item confirmation before host settles tab) | High | Small |
| OE-10 | Shift handoff for claimed orders (transfer to replacement runner) | Medium | Small |
| OE-11 | Reservation name matching at admission (auto-suggest matching bookings) | Medium | Small |
| OE-12 | Wristband/stamp tracking (physical identifier on admission for in-venue verification) | High | Small |
| OE-13 | VIP expedited entry flag (tier-based skip-the-line indicator at door) | Medium | Small |
| OE-14 | Re-entry cutoff time (configurable, enforce at door) | Medium | Small |
| OE-15 | Smoke break vs exit distinction (re-entry-expected pattern) | Medium | Small |
| OE-16 | Staggered admission warnings (alert when within X of legal capacity) | Medium | Small |
| OE-17 | Guest-list capacity enforcement (+1 tracking, per-event cap, per-promoter allocation) | **Critical** | Medium |
| OE-18 | Guest-list bulk import (CSV upload with validation) | High | Medium |
| OE-19 | Event run sheet (timeline: doors, opener, headliner, bottle parade) | Medium | Small |
| OE-20 | Event-specific menu/pricing (scoped items/packages to event window) | Medium | Medium |
| OE-21 | "Guest of" grouping on guest lists (+1s attributed to named guest) | Medium | Small |
| OE-22 | Overtime detection & alerting (configurable threshold, manager notification) | High | Small |
| OE-23 | Late-arrival tracking (flag + accumulation, manager notification at threshold) | High | Small |
| OE-24 | No-show auto-detection (shift start + X min → notify manager → suggest replacement) | High | Small |
| OE-25 | Break compliance alerting (configurable requirement, notify if missed) | Medium | Small |
| OE-26 | Shift-swap deadline (configurable cutoff, enforce at request time) | Medium | Small |
| OE-27 | Pre-shift briefing notes (manager sends briefing to all starting staff) | Medium | Small |
| OE-28 | Staff performance metrics per shift (orders, revenue, fulfillment time, comp rate) | Medium | Medium |
| OE-29 | Incident escalation workflow (severity bump, security lead assignment, notification chain) | High | Small |
| OE-30 | Witness & CCTV tracking (names, contacts, statements; camera + timestamp reference) | High | Small |
| OE-31 | Medical incident checklist (ambulance, paramedics, transport, report) | Medium | Small |
| OE-32 | Post-incident action tracking (assignable task items from incident review) | Medium | Small |
| OE-33 | Supplier performance tracking (on-time rate, fill rate, quality per supplier) | Medium | Small |
| OE-34 | Inter-zone stock transfer movement type | Medium | Small |
| OE-35 | Pre-service / post-service inventory checklists | Medium | Small |

### CRM & Guest Identity Features (NEW)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| CRM-01 | Staff notes on guest profiles (free-text, author-stamped, visible at touchpoints) | Medium | Small |
| CRM-02 | Linked guest profiles (many-to-many, "always comes with") | Medium | Small |
| CRM-03 | Guest photo (profile photo for VIP recognition and banned-guest identification) | High | Medium |
| CRM-04 | Spend-by-category tracking (what does this guest buy?) | Medium | Medium |
| CRM-05 | Visit cadence analysis (pattern detection, dormant VIP alerts) | Medium | Medium |
| CRM-06 | Guest referral tracking (attribution chain, referral bonus basis) | Medium | Small |
| CRM-07 | GDPR / data deletion request workflow | Medium | Medium |

**Recommended sub-phasing** (consistency review F-11, 2026-07-28): Phase 3 is
~86 features across 4 domains — too large for a single milestone. Subdivide into:

| Milestone | Scope | Gate |
|-----------|-------|------|
| 3a — Financial Foundation | Plans 18–19 (workforce + cost/supply) | Labour cost and product cost flow into analytics |
| 3b — Revenue & Guest Experience | RV-01 through RV-21 + Plan 20 (navigation) | Time-slotted reservations, split-bill, auto-gratuity live |
| 3c — Operational Efficiency | OE-01 through OE-35 | SLA timers, door ops, shift management complete |
| 3d — CRM & Identity | CRM-01 through CRM-07 | Guest profiles fully operational |

Each milestone ships independently with its own exit criteria. Decompose features
into implementation stories (acceptance criteria, permissions, tests) at the start
of each milestone, not all at once.

**Exit criteria (Phase 3):** All RV, OE, and CRM features implemented (demo track
first, then graduated). All plans 16–20 live-graduated. The product supports a
complete nightclub operational cycle from opening checklist through peak service
to closing reconciliation. Business logic audit score ≥ 85%.

---

## Phase 4 — Automation & Intelligence (ANALYTICS DEPTH + AUTOMATIONS)

**Status: not started.**

The system doesn't just record — it predicts, alerts, and recommends. Analytics
gain comparison, forecasting, and export. Automations reduce manual work.

### Analytics Depth (Builds on Plan 09c)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| AI-01 | Night-over-night comparison (tonight vs last Saturday vs avg Saturday) | **Critical** | Medium |
| AI-02 | Forecast / projection engine (current pace → projected end-of-night) | High | Medium |
| AI-03 | Per-hour breakdown dashboard (revenue, orders, admissions heatmap) | High | Medium |
| AI-04 | Door-to-table conversion funnel (admissions → sessions → orders) | High | Medium |
| AI-05 | Table-turn analytics (avg occupancy duration, seatings per night) | High | Medium |
| AI-06 | Order SLA / time-to-serve analytics (avg by zone, staff, hour) | High | Medium |
| AI-07 | Comp/void ratio monitoring (per-staff, threshold alerting) | High | Medium |
| AI-08 | Report CSV export & email delivery (close plan 09/09c's unshipped leg) | **Critical** | Medium |
| AI-09 | Promoter performance report (fill rate, check-in rate, spend, commission) | High | Medium |
| AI-10 | Security incident pattern report (by zone, time, night, staff presence) | Medium | Medium |
| AI-11 | Guest retention report (repeat rate, churn, new vs returning) | Medium | Medium |
| AI-12 | Bottle service utilization report (by brand, zone, time; presentation frequency) | Medium | Medium |
| AI-13 | Capacity utilization report (peak occupancy, entry/exit rates, avg stay) | Medium | Medium |
| AI-14 | Night summary auto-generation (one-page executive summary at venue close) | Medium | Medium |

### Automations (NEW)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| AM-01 | Auto-release overdue reservations (no-show after configurable grace period) | High | Small |
| AM-02 | Auto-generate suggested purchase order from par levels vs current stock | **Critical** | Medium |
| AM-03 | Auto-escalate overdue orders (SLA breach → manager alert → auto-unclaim) | High | Small |
| AM-04 | Auto-detect duplicate reservations (same phone/email on same date) | Medium | Small |
| AM-05 | Auto-flag guests for VIP tier upgrade (configurable threshold) | Medium | Small |
| AM-06 | Auto-apply event-specific pricing/menu during event window | Medium | Medium |
| AM-07 | Auto-close event at configured end time | Medium | Small |
| AM-08 | Auto-remove from 86-board when inventory is restocked | Medium | Small |
| AM-09 | Auto-calculate pour cost per drink from recipe BOM + current cost | High | Medium |
| AM-10 | Auto-flag unusual stocktake variance (>X% discrepancy → investigate) | Medium | Small |
| AM-11 | Auto-notify VIP host when assigned VIP arrives or makes reservation | High | Small |
| AM-12 | Auto-flag dormant VIPs (no visit in 90 days → outreach prompt) | Medium | Small |
| AM-13 | Auto-suggest table for party size based on availability | Medium | Medium |

**Exit criteria:** All AI and AM features implemented. Analytics dashboard includes
comparison views and projections. Night summary auto-generates and emails. Core
automations reduce manual staff actions by ≥ 30%.

---

## Phase 5 — Mobile Experience (PWA + PUSH NOTIFICATIONS)

**Status: plan 28 planned, not started.**

Mobile is the primary staff interface. A PWA with push notifications transforms
the staff experience from "check the dashboard" to "the dashboard tells you."

### PWA Foundation (Plan 28, expanded scope)

| Code | Feature | Depends on | Priority |
|------|---------|-----------|----------|
| PWA-01 | Service Worker registration with cache-first strategy for app shell | 28 | **Critical** |
| PWA-02 | Web App Manifest (installable, standalone mode, themed splash screen) | 28 | **Critical** |
| PWA-03 | App shell architecture (instant loading, skeleton states while data fetches) | 28 | High |
| PWA-04 | Offline indicator (banner when connectivity lost, graceful degradation) | 28 | High |
| PWA-05 | Offline action queue (queue actions locally, sync on reconnect) | 28 | Medium |
| PWA-06 | Responsive mobile-first layouts for all staff surfaces | 20 | High |
| PWA-07 | Background sync for queued actions | 28 | Medium |
| PWA-08 | Update lifecycle (prompt user to refresh when new version available) | 28 | Medium |

### Push Notification System (Plan 28 expanded + new)

| Code | Feature | Depends on | Priority |
|------|---------|-----------|----------|
| PSH-01 | Web Push API integration (browser + PWA) | 28, 25 | **Critical** |
| PSH-02 | Push subscription management (register, unsubscribe, token rotation) | PSH-01 | **Critical** |
| PSH-03 | Notification preference centre (per-user, per-channel: push/email/SMS) | 25, 26, PSH-01 | High |
| PSH-04 | Role-based notification routing (manager alerts vs staff alerts vs guest alerts) | 25, PSH-01 | High |
| PSH-05 | Event-driven notification engine (domain event → template → recipient → delivery) | 25, PSH-01 | **Critical** |
| PSH-06 | Notification history & delivery tracking (sent, delivered, clicked, failed) | 25, PSH-01 | Medium |
| PSH-07 | Quiet hours (configurable per user, suppress non-critical notifications) | PSH-03 | Medium |
| PSH-08 | Retry policies with exponential backoff | 25, PSH-05 | Medium |
| PSH-09 | Notification templates: VIP arrival, reservation check-in, capacity alert, incident escalation, shift reminder, shift change, event reminder, waitlist promotion, security alert, operational announcement, certification expiry, compliance deadline, minimum-spend progress | PSH-05 | Medium |

### Operational Notifications to Wire

| Trigger | Channels | Recipients |
|---------|---------|-----------|
| VIP guest arrival at door | Push, SMS | VIP host, host |
| Reservation check-in | Push | Host, promoter |
| Capacity approaching legal limit | Push | Manager, door host, security lead |
| Incident reported (high severity) | Push, SMS | Manager, security lead |
| Incident escalated | Push | Manager, security lead |
| Staff shift starts in 30 min | Push | Staff member |
| Shift change / swap approved | Push, Email | Both staff members |
| Event starting in 1 hour | Push | Manager, all working staff |
| Waitlist guest notified (table ready) | Push, SMS | Guest |
| Security alert / ejection | Push | All security, manager |
| Certification expiring in 30/14/7 days | Push, Email | Staff member, manager |
| Compliance deadline approaching | Push, Email | Manager, compliance officer |
| Minimum-spend behind pace | Push | Host |
| Tab closure requested | Push | Host |
| Table released from hold | Push | Host |
| Stock below par level | Push | Bar manager, inventory manager |
| PO ready for submission | Push | Inventory manager |
| Stocktake overdue | Push | Bar manager |
| Pour cost target breached | Push | Manager, bar manager |
| Emergency broadcast | Push | All staff |

**Exit criteria:** Staff can install the PWA on any device. Push notifications
deliver within 3 seconds of the triggering event. Notification preferences are
honoured per user per channel. All 20 operational notification triggers wired.
Offline indicator and action queue functional. The PWA Lighthouse score ≥ 90.

---

## Phase 6 — Production Readiness (PLANS 22–24, 27, 29)

**Status: not started.**

Before a real venue signs, the platform must be hardened, monitored, backed up,
localized, and legally compliant. This phase is security + observability + data
integrity + i18n + compliance — no new product features.

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 22 | Security hardening: rate limits, headers, CSP report-only, secrets scan, cookie flags | 01–10 | Med |
| 23 | Observability: structured logging (pino), error tracking (Sentry), health checks, uptime monitoring | — (22 pairs well) | Low-Med |
| 24 | Database operations: automated backups, restore drill, connection pooling, index audit | 12, staging DB | Med |
| 27 | i18n: full French/English UI chrome, locale toggle, `guestLocale` on venue, plan-25/26 templates gain French variants | — (29 renders through it) | Med |
| 29 | Compliance & privacy (Law 25/PIPEDA): consent management, retention policies, deletion paths, breach register, published policy pages | 25 (17 supplies guest/incident data, 27 supplies bilingual rendering) | Med |

**Phase boundaries:** Phase 6 delivers no product features. It exists to make the
existing product production-safe. Every customer-data table, every log line, and
every UI string is accounted for. The go/no-go checklist (`production-ready-b2b-saas-balanced.md`)
is satisfied.

**Exit criteria:** Security scan clean. Backup restore drill passed. Health
checks green. French UI complete for guest + public surfaces (ops French can
trail). Published privacy policy and consent management in place. Retention
cron jobs active. Breach response procedure documented and contact-tested.

---

## Phase 7 — CI/CD, Deployment & Release Automation

**Status: DEFERRED until Phases 1–6 are complete.**

This phase is intentionally last. Automating deploys of an incomplete product
is premature optimization. Plan 21 (CI/CD) moves here in its entirety, plus
additional deployment automation work.

### CI/CD (Plan 21, moved from prior position)

| # | Feature | Depends on | Risk |
|---|---------|-----------|------|
| 21 | CI/CD pipeline: GitHub Actions, branch protection, lint/typecheck/test/build gates, staging auto-deploy, rollback rehearsal, RUNBOOK deployment procedures | — | Low |

### Deployment & Release Automation (NEW)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| DPL-01 | Automated staging deploy on merge to `dev` | Critical | Medium |
| DPL-02 | Automated production deploy on merge to `master` (with manual approval gate) | Critical | Medium |
| DPL-03 | Environment promotion (staging → production with smoke tests) | High | Medium |
| DPL-04 | Blue-green / rolling deploy strategy (zero-downtime for live venues) | High | Large |
| DPL-05 | Infrastructure-as-code (Coolify config versioned in repo) | High | Medium |
| DPL-06 | Database migration automation (run migrations in deploy pipeline) | Critical | Small |
| DPL-07 | Secrets rotation automation | Medium | Medium |
| DPL-08 | Canary deployments (route X% traffic to new version) | Medium | Large |
| DPL-09 | Automated rollback (one-click or auto-triggered on health check failure) | High | Medium |
| DPL-10 | Deployment audit log (who deployed what when) | Medium | Small |

### Production Operations (NEW)

| Code | Feature | Priority | Complexity |
|------|---------|----------|------------|
| OPS-01 | Disaster recovery runbook (tested quarterly) | Critical | Medium |
| OPS-02 | Automated backup verification (restore test monthly) | Critical | Medium |
| OPS-03 | Production monitoring dashboard (Grafana or Coolify built-in) | High | Medium |
| OPS-04 | Alerting rules (error rate, latency p95, DB connections, disk usage) | High | Medium |
| OPS-05 | On-call rotation & escalation policy | High | Small |
| OPS-06 | SLA reporting (uptime, incident response time) | Medium | Small |
| OPS-07 | Capacity planning automation (predict when to scale based on growth) | Low | Medium |

**Why CI/CD is deferred to Phase 7:** The CI/CD pipeline from plan 21 is
development infrastructure — it supports the team building features, not the
venue running them. A `dev`-branch CI gate (lint + typecheck + test) that runs
on every PR is reasonable to set up early as a development convenience, but
production-grade CI/CD with automated deploys, blue-green strategies, and
rollback automation should not consume engineering cycles while the product is
functionally incomplete. The principle: **automate the delivery of a complete
product, not the delivery of a work-in-progress.**

**Minimal CI during development (permitted early):**
- PR lint + typecheck + unit test gate on `dev` branch
- That's it. No staging deploys, no production pipelines, no Docker optimization,
  no Kubernetes, no infrastructure automation. These are Phase 7.

**Exit criteria:** Full CI/CD pipeline operational. Staging deploys on merge.
Production deploys with approval gate. Rollback rehearsed and documented.
Disaster recovery runbook tested. All OPS features implemented.

---

## DEPENDENCY MAP

```
Phase 1 (Foundation: plans 01–15)
  │
  ├─► Phase 2 (Core Ops: plans 16–17 + 25–26 + S-01→S-04)
  │     │
  │     ├─► Phase 3 (Business Logic: plans 18–20 + RV/OE/CRM features)
  │     │     │
  │     │     └─► Phase 4 (Automation & Intelligence: AI/AM features)
  │     │           │
  │     │           └─► Phase 5 (Mobile: PWA + Push: plan 28 expanded)
  │     │                 │
  │     │                 └─► Phase 6 (Production Readiness: plans 22–24, 27, 29)
  │     │                       │
  │     │                       └─► Phase 7 (CI/CD & Deploy: plan 21 + DPL/OPS)
  │     │
  │     └─► Plans 25–26 (Notifications) feed Phases 3–7
  │
  └─► Plan 20 (Navigation) ships alongside Phase 3 so new destinations
      land in the new IA, not appended to the old list
```

Key dependency rules:
- **Plans 25–26 (notifications) must ship in Phase 2.** Every feature in
  Phases 3–7 that says "notify X when Y" depends on the dispatch layer.
- **Plan 20 (navigation UX) ships in Phase 3** alongside plans 18–19 and the
  new operational features so that ~15 new manager destinations have a designed
  home, not a tacked-on sidebar link.
- **Phase 6 (production readiness) gates real-venue onboarding.** Security,
  observability, backups, i18n, and compliance must be in place before a
  venue signs a contract.
- **Phase 7 (CI/CD) is explicitly after Phase 6.** Don't automate deploys of
  an incomplete product.

---

## PARKING LOT (DEFERRED)

| Deferred | Reason |
|---|---|
| Guest card payments (Stripe Connect) | Deliberate product omission. Consumer CC fraud risk with anonymous nightclub guests. Tenant SaaS billing (Stripe subscriptions for plan management) is the sole payment integration. |
| Multi-venue owner accounts (cross-venue rollups, shared menus/staff, regional roles) | Explicitly deferred. Triggers on second venue sign-up from same owner. |
| POS/KDS integrations, printer hardware | No customer demand yet. Earn them. |
| Native iOS/Android apps | PWA (Phase 5) covers the need without two app stores. |
| Marketing email/SMS campaigns | Plans 25–26 are transactional only. CASL consent infrastructure not built. |
| Metrics timeseries stack (Prometheus/Grafana/Loki) | Sentry + health checks cover incidents. Timeseries earned by trend-analysis demand. |
| Redis-backed rate limiting | Single VPS; in-memory limiter correct for topology. |
| ~~Queue infrastructure (BullMQ)~~ | **Resolved (2026-07-28):** BullMQ adopted for staging/prod (OVHcloud); local live dev (`dev:pglite`, `dev:stack`) uses cron-job fallback — no Redis dependency for local development. Plan 30 §3 is the implementation vehicle. |
| Self-serve DSAR portal / GDPR | Law 25/PIPEDA covered by documented procedure (plan 29). No EU market. |
| Locales beyond fr/en, RTL | Plan 27 ships fr/en only — the QC market's actual requirement. |
| Offline mode beyond Phase 5 action queue | Full offline with SW caching all application data breaks deploys. Offline queue + app shell covers the stated requirements (door admission, incident filing during brief outages). |
| Enforced CSP for scripts | Plan 22 ships report-only. Next.js inline runtime makes enforcement its own project. |

---

## DEFINITION OF DONE — EVERY FEATURE

1. **Demo-track features (RV, OE, CRM, AI, AM, PWA, PSH codes):**
   Mock data → mock service → UI, in demo mode, behind `isDemoMode()`. Iterate
   until UX settled. GA-1.14: every demo-track feature has a `TODO(backend)`
   listing what the live implementation needs.
2. **Live graduation (plan numbers):**
   Plan followed or updated in same PR with why. Real service `satisfies`
   mock type. Selector wired. Call sites and mock untouched (R1, AD-14).
   Simulations gated behind `isDemoMode()`. Tests per AGENTS.md §7b.
3. **Verification ladder:** tsc → eslint → test suite → preview drive → build.
   Green on every merge.
4. **Documentation:** AGENTS.md / ARD / DDD / PRD / ROADMAP edited if feature
   made any of them stale (§9.9).

---

## RELEASE CADENCE

- **Permanent branches:** `dev` (staging) and `master` (production + demo).
- **Work branches:** branch from `dev`, merge back via PR.
- **Plan-numbered features:** `feature/NN-shortname`.
- **Audit-identified features:** `feature/code-shortname` (e.g. `feature/rv-05-order-priority`).
- **Release PRs:** `dev` → `master` when stable and QA'd on staging.
