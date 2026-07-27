# ROADMAP — Backend Implementation

Order follows AGENTS.md §9.4 (riskiest-cheapest first), extended with the
foundation and auth prerequisites. Each feature has a full plan in `docs/plans/`;
nothing starts without its plan's "Preconditions" satisfied. The app runs in a
mixed state throughout — some services real, some mock — because every step swaps
method bodies behind a stable interface (R1).

## Sequence

| # | Feature | Plan | Depends on | Risk | Consumes TODOs in |
|---|---------|------|-----------|------|-------------------|
| 01 | Foundation: Postgres, Prisma, scoped client, cents, test infra, seeds — complete | [01-foundation-PLAN](plans/01-foundation-PLAN.md) | — | Low | `types.ts` |
| 02 | Authentication & authorization — complete | [02-authentication-PLAN](plans/02-authentication-PLAN.md) | 01 | Med | `auth-service`, `auth-context`, `admin-gate`, `staff/layout`, `staff-edit-dialog` |
| 03 | Venue, zones & tables — complete | [03-venue-zones-tables-PLAN](plans/03-venue-zones-tables-PLAN.md) | 01, 02 | Low | `venue-service`, `settings`, `qr` (tokens land in 06) |
| 04 | Menu, inventory & packages — complete | [04-menu-inventory-PLAN](plans/04-menu-inventory-PLAN.md) | 03 | Med | `menu-service` (ledger), `inventory`, `menu` pages |
| 05 | Orders & fees (CORE) — complete | [05-orders-fees-PLAN](plans/05-orders-fees-PLAN.md) | 04 | **High** | `orders-service`, `cart-contents`, `happy-hour` pricing, `package-card` |
| 06 | Guest sessions, QR tokens & help — complete | [06-guest-sessions-help-PLAN](plans/06-guest-sessions-help-PLAN.md) | 05 | Med | `guests-service`, `guest-context`, `g/[tableCode]`, `approvals` |
| 07 | Realtime & floor pulse — complete | [07-realtime-pulse-PLAN](plans/07-realtime-pulse-PLAN.md) | 05, 06 | Med | all 6 polling TODOs, `pulse-service`, `show-queue-service`, `staff-service` chat |
| 08 | Reservations, events & promotions — complete | [08-reservations-events-promotions-PLAN](plans/08-reservations-events-promotions-PLAN.md) | 03, 05 | Low | `reservation-service`, `events-service`, `promotions-service` |
| 09 | Analytics & report engine — complete except scheduled email* | [09-analytics-reports-PLAN](plans/09-analytics-reports-PLAN.md) | 05 | Med | `analytics-service`, `report-service`, `mock-chart` |
| 09b | V1 operational closure — complete | [09b-v1-operational-closure-PLAN](plans/09b-v1-operational-closure-PLAN.md) | 02–07, 09 | Med | category/add-on ordering, live `staff-service`, session/table closure, venue time, strict mode isolation, fulfilled migration markers |
| 09c | Analytics depth & reporting expansion — complete except scheduled email* | [09c-analytics-depth-reporting-PLAN](plans/09c-analytics-depth-reporting-PLAN.md) | 08, 09, 09b | Low‑Med | session/reservation/happy-hour/event/promotion metrics, deepened staff/order/inventory analytics, new report metrics + CSV sections |
| 10 | Platform admin & billing — complete | [10-platform-admin-billing-PLAN](plans/10-platform-admin-billing-PLAN.md) | 02, 09b | Med | `admin-service`, `billing-service`, `subscription`, `pricing`, `lead` pages |
| 11 | Luxe VIP Gold visual revamp — complete | [11-luxe-vip-gold-revamp-PLAN](plans/11-luxe-vip-gold-revamp-PLAN.md) | — (presentation-layer) | Low | none — design-system tokens, shared primitives, guest/public/ops reskin |
| 12 | Containerized local dev — complete | [12-local-dev-containers-PLAN](plans/12-local-dev-containers-PLAN.md) | — (tooling-only) | Low | none — Dockerfile, compose.yaml, npm scripts, docs |
| 13 | Embedded reservations & QR gate — demo complete | [13-embedded-reservations-PLAN](plans/13-embedded-reservations-PLAN.md) | 03, 06, 08, 09 | Low | `reservation-service` (channel, PIN, public avail), `venue-service` (publicSlug), `entity-links`, floor-map canvas extraction |
| 14 | Promoters: role, mobile panel & attribution analytics | [14-promoters-PLAN](plans/14-promoters-PLAN.md) | 08, 09/09c, 13 (15 shares the role seam) | Med | reservation/session attribution chain, role-driven staff nav, promoter analytics + report metrics |
| 15 | Floor-role capability matrix, security panel & demo personas | [15-floor-roles-security-PLAN](plans/15-floor-roles-security-PLAN.md) | 07, 09b (14 shares the role seam) | Med | runner redefinition, security help/schedule/chat panel, per-role demo sign-ins, admin login-card removal |
| 16 | The tab as a financial object: minimums, adjustments, transfers & cash-out | [16-tab-ledger-adjustments-PLAN](plans/16-tab-ledger-adjustments-PLAN.md) | 05, 06, 09b, 15 | **High** | `minimumSpend` unread, all-or-nothing `order:gift`, unrolled `SettlementMethod`, unaudited `sensitive` actions |
| 17 | Door, arrival, guest identity & safety | [17-door-arrival-guest-identity-PLAN](plans/17-door-arrival-guest-identity-PLAN.md) | 08, 13, 15, 16 | Med‑High | no door/occupancy/waitlist surface, event-only check-in, `EventGuest` non-identity note, missing `no-show`, security role without a domain |
| 18 | Workforce: time clock, scheduling, tips & commissions | [18-workforce-time-incentives-PLAN](plans/18-workforce-time-incentives-PLAN.md) | 09b, 14, 15, 16 | Med | `isOnShift` manual toggle, template-only `StaffShift`, uncredited tips, promoter analytics with no settlement |
| 19 | Cost, supply chain & profitability | [19-cost-supply-profitability-PLAN](plans/19-cost-supply-profitability-PLAN.md) | 04, 09/09c, 16, 18 | Med | costless `restock` movements, no par/reorder, no stocktake, `adjustment` overloaded, revenue-only analytics |
| 20 | Navigation & UX overhaul | [20-navigation-ux-overhaul-PLAN](plans/20-navigation-ux-overhaul-PLAN.md) | — (presentation-layer; pairs with 16–19) | Low | flat 18-item nav, mobile pill strip, no search/palette, dashboard-only attention, split active-state logic |
| 21 | CI/CD & deployment runbook | [21-cicd-deployment-PLAN](plans/21-cicd-deployment-PLAN.md) | — | Low | none — `ci.yml`, branch protection, rollback rehearsal, RUNBOOK deploys |
| 22 | Security hardening | [22-security-hardening-PLAN](plans/22-security-hardening-PLAN.md) | 01–10 | Med | `rate-limit.ts` coverage gaps, headers, cookie flags, secrets scan |
| 23 | Observability: logging, errors, health, uptime | [23-observability-PLAN](plans/23-observability-PLAN.md) | — (22 pairs well) | Low‑Med | none — pino, Sentry, `/api/health`, Uptime Kuma, RUNBOOK triage |
| 24 | Database operations & backups | [24-database-operations-PLAN](plans/24-database-operations-PLAN.md) | 12, staging DB | Med | backups + restore drill, roles, pooling, index audit |
| 25 | Notification core & email (Resend) | [25-notifications-email-PLAN](plans/25-notifications-email-PLAN.md) | 02, 08, 09/09c, 13 | Med | AD-8/AD-9 markers in report/rollup code; staff invite link-only path |
| 26 | SMS notifications (Twilio) | [26-notifications-sms-PLAN](plans/26-notifications-sms-PLAN.md) | 25 | Low‑Med | plan-13 PIN-delivery TODO; plan-17 waitlist "notify" TODO |
| 27 | i18n: full French/English support | [27-i18n-french-english-PLAN](plans/27-i18n-french-english-PLAN.md) | — (29 renders through it; 25/26 templates) | Med | hardcoded UI strings app-wide, `format.ts` locales, venue `guestLocale`, locale toggle beside `ThemeToggle` |
| 28 | PWA, web push & notification preferences | [28-pwa-web-push-PLAN](plans/28-pwa-web-push-PLAN.md) | 07, 25 | Med | none — manifest/SW, `PushSubscription`, `NotificationPreferences`, push channel on the dispatcher |
| 29 | Compliance & privacy (Law 25 / PIPEDA) | [29-compliance-privacy-PLAN](plans/29-compliance-privacy-PLAN.md) | 25 (17 supplies the guest/incident data map) | Med | policy/ToS pages, consent, retention job, deletion paths, breach register |

\* **Scheduled email is the one unshipped leg of plans 09/09c.** The report
engine stores `schedule` and computes due-selection, rollups have
`computeRollup`/`upsertRollup`, and the `job_runs` table exists — but no cron
handler (`/api/jobs/*`) invokes them and no email sender is wired (AD-8 Resend
never landed; staff invites currently surface as copyable links via Better
Auth). **Plan 25 closes this** — the footnote dies when it ships.

Rationale for the two deviations from a naive order: **auth before venue CRUD**
because R2 (tenant scoping) needs a session to scope by, and retrofitting auth
under live features is the classic trap; **orders before guest sessions** because
the order transaction (money + inventory, INV-O2/O4) is the highest-risk work and
deserves the team's freshest attention — sessions then attach to a proven core.

Plan 09b is a corrective checkpoint, not a new product area: it closes live-mode
identity, table-lifecycle, venue-time, fail-closed mode/resource isolation and
failure-recovery seams found after plans 01–09 were integrated. It precedes plan
10 so the platform graduation flow does not provision and bill a tenant whose
core night still depends on seeded staff, simulation controls, mock services or
hard-coded operating assumptions. Its one product addition—category/package
washer and presentation presets—follows the permanent demo-first lifecycle inside
the plan: accepted mock UX first, tested backend graduation second.

Plan 09c widens plan 09's aggregation scope rather than adding product surface:
in-depth metrics for sessions, reservations, happy hours, events and
promotions (plus deeper staff/order/inventory numbers), all flowing into the
existing report engine as new selectable metrics and CSV sections. It is
almost entirely reads over data plans 05–09b already record — the one new
write is happy-hour attribution snapshots on orders. It can land before or
after plan 10; it depends on 09b only for live staff identity and venue night
config.

Plan 13 is a demo-track feature addition (AD-14): it adds an embeddable public
reservation page at `/r/[venueSlug]` with a floor-map table picker, channel
attribution (embed/direct/walk-in) on reservations, and a QR gate that demands
a 6-digit PIN when a guest scans a table with an active confirmed reservation.
The demo-track work (types, mock service, UI, FloorMapCanvas extraction) is
complete; the Prisma schema migration for `channel`, `guestEmail`, `guestPhone`,
`reservationPin` and `publicSlug` is committed. Graduation to live requires
implementing the public reservation API routes and wiring the live service
selector branch.

Plans 14–15 are the **workforce wave** — demo-track product features per the
AD-14 lifecycle. Plan 14 adds the promoter role: a mobile panel scoped to
their own funnel (reservations CRUD, read-only order tracking, assigned-only
Home/Orders/Approvals plus Events and Reservations tabs) and the manager-side
attribution analytics (Promoters tab after Staff, custom-report metrics) that
answer "who funnels the most guests, who brings the spenders". Plan 15
centralizes floor-role permissions in one capability matrix (runner redefined
as fulfillment-only assistant: prepare/ready/deliver, no order accept, no
session approvals, zone-scoped help), gives security a minimal panel (security
help requests, schedule, chat), and restructures the demo with one sign-in
persona per floor role (Platform Admin card removed from the demo login —
`/admin` stays URL-reachable). The two plans share the role-capability seam;
whichever lands first ships it. Both sketch mock-first; graduation enforces
the same matrix server-side.

Plans 16–20 are the **operations-completeness wave** — the product work that
turns a strong nightly-ops prototype into a nightclub operating system. They
come from two reviews committed alongside them:
`docs/BUSINESS-LOGIC-GAP-REVIEW.md` and `docs/UX-REVIEW.md`. Four close
business-logic gaps, one closes the navigation/UX gap:

- **16 — the tab as a financial object.** `minimumSpend` becomes enforced and
  visible; void/comp/discount replace the all-or-nothing gift, each with a
  reason code, an author and an append-only adjustment ledger; sessions can
  transfer, merge and split; the night reconciles by settlement method in a
  cash-out. It also ships the venue-wide **audit trail** that plans 17–19 write
  to — which is why it goes first.
- **17 — the door.** The one whole missing area: live occupancy against legal
  capacity, an admission/arrival log, a walk-in waitlist, one check-in flow for
  reservations *and* guestlists, coat check, plus persistent **guest identity**
  (VIP recognition at approval time, a ban list, `no-show` tracking) and
  **incident reports** — which finally give the `security` role a domain rather
  than a filtered help queue.
- **18 — workforce.** `isOnShift` becomes a real time clock over dated shift
  instances; scheduling gains publish/swap/time-off/coverage warnings; tips are
  pooled and distributed by an explainable rule; promoters get the commission
  settlement their analytics (plan 14) already measure. This is the labour half
  of margin.
- **19 — cost & supply.** Suppliers, purchase orders with unit costs, par levels
  and reorder alerts, stocktakes with variance, waste as its own movement type,
  by-the-pour tracking. This is the product half of margin: every existing
  revenue report becomes a margin report, and the dashboard finally answers
  "did we make money tonight".
- **20 — navigation & UX overhaul.** Presentation-layer only, like plan 11:
  grouped nav from one definition, a real mobile manager nav, a ⌘K palette over
  `entity-links.ts`, attention hoisted out of the dashboard tab, URL-backed view
  state, breadcrumbs, a keyboard model, and an explicit undo-vs-confirm policy.
  It is sequenced with 16–19 rather than after them so their ~10 new
  destinations are designed into the new IA instead of appended to the old list.

**Multi-venue owner accounts remain deferred** (parking lot below) — the gap
review's §9 is deliberately out of this wave's scope.

Plans 21–29 are the **production-readiness wave**, driven by the go/no-go
checklist (`production-ready-b2b-saas-balanced.md`, adapted — items the
architecture already satisfies by construction are audited, not rebuilt),
and are **numbered in execution order**. Four are operational: 21 (CI/CD),
22 (security hardening), 23 (observability) and 24 (database ops + tested
backups). Four are product features: 25 (notification dispatch core +
Resend email, absorbing the parked AD-8/AD-9 debt), 26 (Twilio SMS —
reservation PIN delivery, plan 13's open TODO, plus plan 17's waitlist
notify), 27 (full French/English i18n — a QC-market requirement, Bill 96,
with a locale toggle beside the theme toggle) and 28 (PWA install + web
push for staff phones). Plan 29 (Law 25/PIPEDA compliance) closes the wave
— it rides 25's cron infra and 27's locale plumbing, must cover the guest
profiles and incident records plan 17 introduces, and gates production
onboarding.

## Go-live gate — staging, then production

Execution order is the numbering: **16 → 17 → 18 → 19 → 20 → 21 → 22 →
23 → 24 → 25 → 26 → 27 → 28 → 29** (the workforce wave 14–15 is demo-track
and can proceed in parallel; its live graduations land like any feature PR
through the CI gate). The product wave 16–20 comes first because hardening,
monitoring and compliance should wrap the product a venue will actually run,
not a subset of it — plan 29 in particular cannot write an honest data
inventory before plan 17 defines what guest data exists. Then: CI first so
every later plan lands through the gate; security and observability before
real traffic; database ops once the staging DB holds anything worth keeping;
the feature wave rides the hardened platform; i18n before compliance so plan
29's bilingual policy pages render through plan 27's locale plumbing (and
plan 25/26 templates gain their French variants); compliance completes before
a real venue signs.

**Product-completeness gate (before the hardening wave):** 16–19 demo-complete
and graduated, 20 shipped to both builds, and the gap review's findings either
closed or carrying a written deferral in this roadmap's parking lot. The point
of the gate is that plan 22's threat surface, plan 24's schema and plan 29's
data inventory are all defined against the *finished* domain.

**Staging go-live requires:** 21 (CI + deploy wiring + rollback rehearsed),
22 (rate limits, headers, secrets scan), 23 (health, logging, error
tracking, uptime alerts), 24 (backups with a performed restore, roles,
pooling). Plans 25–28 are validated *on* staging, not prerequisites for it.

**Production onboarding of a real venue additionally requires:** 25 and 26
(a venue's guests must actually receive PINs and confirmations), 29 in full
(published policy, consent, retention, deletion, breach procedure — covering
plan 17's guest profiles and incident records), 27 at least through its guest
+ public workstreams (Bill 96: a QC venue's guests must be servable in French
— ops-area French can trail), and the checklist's launch-day script executed
with evidence. 28 (PWA/push) is strongly recommended for floor-staff UX but is
not a legal or safety gate.

The go/no-go checklist maps to plans as: Security → 22 (+02/AD-3/AD-7 by
construction) · Database → 24 · Rate limiting & input → 22 · Code & testing
→ 21 (CI enforcement; suites exist per §7b) · Infrastructure & monitoring →
21 + 23 · Compliance → 29. Any unchecked row at gate time carries a written,
dated deferral in `docs/SECURITY.md` or the relevant plan — silence is not a
pass.

## Demo co-existence (AD-14) — how to read the plans

The mocks are **not retired**: they power the public Live Demo permanently. So
wherever a plan says "swap the body of `mockXService.m`" or "rename
`mockXService → xService`", read instead:

1. implement `realXService.m` declared `satisfies XService`
   (where `type XService = typeof mockXService`),
2. wire it through the `src/lib/services/x-service.ts` selector,
3. leave `mockXService` untouched (it stays demo + fixture source),
4. gate — don't delete — any simulation the feature obsoletes
   (`isDemoMode()`), and
5. `TODO(backend)` deletion still applies: the TODO is fulfilled by the real
   implementation existing, even though the mock line it sat on survives —
   move the comment's intent into the plan's exit note if context would be lost.

Every step ordering, test list and exit criterion in the plans remains valid
under this reading. Plan 01 ships the selector/mode infrastructure.

## Ongoing: demo-first feature lifecycle

Plans 01–10 graduate the *existing* features. New features — during and after
the migration — follow the permanent loop (AD-14):

1. **Sketch in the sandbox**: mock data → mock service → UI, demo mode,
   Phase-1 rules. `TODO(backend)` annotations record backend intent.
2. **Iterate until the UX is settled** — the demo build is the review
   environment; killing a feature here costs zero backend work.
3. **Demo-only gate**: entry points behind `isDemoMode()` until graduated —
   the live build never shows a feature without a real backend.
4. **Graduate**: write the next `docs/plans/NN-featurename-PLAN.md` (same
   template: reasoning, design choices, implementation strategy, testing,
   review checklist, exit criteria), implement the real branch, wire the
   selector, drop the gate — one PR, this definition of done.

Numbering continues from 30. UI sketching for new features can proceed in
parallel with backend plans — the two tracks only meet at graduation.

## Definition of done — every feature, no exceptions

1. Plan's design followed or the plan updated in the same PR with why.
2. Real service implemented `satisfies` the mock's type and wired through the
   selector; **call sites and mock untouched** (R1, AD-14).
3. Simulations it obsoletes gated behind `isDemoMode()` in the same PR (R7);
   the demo build still exercises them.
4. Tests per AGENTS.md §7 Phase 2 — money/state-machine units *before* the
   implementation, route-handler integration incl. tenant-isolation attempts,
   the plan's named E2E flow.
5. `TODO(backend)` comments it fulfils deleted in the same commit (§9.2).
6. Verification ladder green (§5): tsc, eslint, suite, preview drive, build.
7. AGENTS.md / this roadmap edited if the feature made either stale (§9.9).

## Phase 3 parking lot (not planned, recorded so they stop haunting scope talks)

Each entry carries its reason so the deferral survives the next scope talk
without relitigating it. An item leaves this table only with a plan number.

| Deferred | Why it stays |
|---|---|
| Guest card payments (Stripe Connect) | **Deliberate product omission, not a backlog item.** Guest payments mean consumer CC fraud, chargebacks and disputes — with anonymous nightclub guests, at night, with alcohol involved. We vet the tenants we onboard; we have zero control over their guests. Orders settle through the venue's existing till — the venue keeps the payment risk it already knows how to carry. |
| Multi-venue owner accounts (group rollups, shared menus/staff, regional roles) | **Explicitly deferred out of the 16–20 wave** — the gap review's §9. No tenants yet; build when a second venue of the same owner signs. `/admin` remains the only cross-tenant surface. |
| POS/KDS integrations, printer hardware | Integration requests must come from real customers — earn them. |
| Native apps | Plan 28 (PWA + push) covers the need without two app stores. |
| Offline mode (incl. any SW caching) | Plan 28 ships a push-only service worker; casual caching breaks deploys. No evidence of need yet. |
| RLS defense-in-depth (AD-3) | App-layer scoping + `expectTenantIsolation()` canaries hold; promote at the first external security audit. |
| Real charting lib (`mock-chart` TODO) | `mock-chart` works until a customer asks for something it can't draw. |
| Marketing email/SMS | Plans 20/21 are transactional-only; no list, and CASL consent infra for commercial messages doesn't exist yet. |
| Enforced CSP for scripts | Plan 22 ships report-only; Next's inline runtime makes enforcement its own project. |
| Metrics timeseries stack (Prometheus/Grafana/Loki) | Plan 23 defers with a named trigger: needed for *trends*, not *incidents* — Sentry + health checks cover incidents. |
| Redis-backed rate limiting | Single VPS process (AD-15); the in-memory limiter is correct for the topology. Revisit at scale-out. |
| Queue infrastructure for sends (BullMQ) | Earned by send volume; synchronous sends suffice at this scale. |
| Self-serve DSAR portal · GDPR | Plan 29 covers Law 25/PIPEDA by documented procedure; request volume doesn't justify a portal. No EU market. |
| Locales beyond fr/en, RTL, venue-content translation, locale-prefixed SEO routing | Plan 27 ships fr/en UI chrome only — the QC market's actual requirement. |

*(Formerly listed here, now planned: scheduled report email → plan 25 ·
reservation PIN delivery via SMS/email → plans 25/26 · notification
preferences UI → plan 28.)*

**Business-logic gaps and their plans.** Every finding in
`docs/BUSINESS-LOGIC-GAP-REVIEW.md` maps to a plan, except §9: §1 door/capacity
→ 17 · §2 tab/adjustments → 16 · §3 workforce → 18 · §4 guest identity → 17 ·
§5 reservations depth → 17 · §6 inventory/supply → 19 · §7 safety &
accountability → 17 (incidents, refusal, responsible service) + 16 (audit
trail) + 29 (retention) · §8 analytics cost side → 19 (product margin) + 18
(labour margin) · **§9 multi-venue → deferred, above.** Every finding in
`docs/UX-REVIEW.md` (1–14) maps to plan 20.
