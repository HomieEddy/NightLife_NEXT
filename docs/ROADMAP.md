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
| 14 | CI/CD & deployment runbook | [14-cicd-deployment-PLAN](plans/14-cicd-deployment-PLAN.md) | — | Low | none — `ci.yml`, branch protection, rollback rehearsal, RUNBOOK deploys |
| 15 | Security hardening | [15-security-hardening-PLAN](plans/15-security-hardening-PLAN.md) | 01–10 | Med | `rate-limit.ts` coverage gaps, headers, cookie flags, secrets scan |
| 16 | Observability: logging, errors, health, uptime | [16-observability-PLAN](plans/16-observability-PLAN.md) | — (15 pairs well) | Low‑Med | none — pino, Sentry, `/api/health`, Uptime Kuma, RUNBOOK triage |
| 17 | Database operations & backups | [17-database-operations-PLAN](plans/17-database-operations-PLAN.md) | 12, staging DB | Med | backups + restore drill, roles, pooling, index audit |
| 18 | Notification core & email (Resend) | [18-notifications-email-PLAN](plans/18-notifications-email-PLAN.md) | 02, 08, 09/09c, 13 | Med | AD-8/AD-9 markers in report/rollup code; staff invite link-only path |
| 19 | SMS notifications (Twilio) | [19-notifications-sms-PLAN](plans/19-notifications-sms-PLAN.md) | 18 | Low‑Med | plan-13 PIN-delivery TODO |
| 20 | i18n: full French/English support | [20-i18n-french-english-PLAN](plans/20-i18n-french-english-PLAN.md) | — (22 renders through it; 18/19 templates) | Med | hardcoded UI strings app-wide, `format.ts` locales, venue `guestLocale`, locale toggle beside `ThemeToggle` |
| 21 | PWA, web push & notification preferences | [21-pwa-web-push-PLAN](plans/21-pwa-web-push-PLAN.md) | 07, 18 | Med | none — manifest/SW, `PushSubscription`, `NotificationPreferences`, push channel on the dispatcher |
| 22 | Compliance & privacy (Law 25 / PIPEDA) | [22-compliance-privacy-PLAN](plans/22-compliance-privacy-PLAN.md) | 18 | Med | policy/ToS pages, consent, retention job, deletion paths, breach register |

\* **Scheduled email is the one unshipped leg of plans 09/09c.** The report
engine stores `schedule` and computes due-selection, rollups have
`computeRollup`/`upsertRollup`, and the `job_runs` table exists — but no cron
handler (`/api/jobs/*`) invokes them and no email sender is wired (AD-8 Resend
never landed; staff invites currently surface as copyable links via Better
Auth). **Plan 18 closes this** — the footnote dies when it ships.

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

Plans 14–22 are the **production-readiness wave**, driven by the go/no-go
checklist (`production-ready-b2b-saas-balanced.md`, adapted — items the
architecture already satisfies by construction are audited, not rebuilt),
and are **numbered in execution order**. Four are operational: 14 (CI/CD),
15 (security hardening), 16 (observability) and 17 (database ops + tested
backups). Four are product features: 18 (notification dispatch core +
Resend email, absorbing the parked AD-8/AD-9 debt), 19 (Twilio SMS —
reservation PIN delivery, plan 13's open TODO), 20 (full French/English
i18n — a QC-market requirement, Bill 96, with a locale toggle beside the
theme toggle) and 21 (PWA install + web push for staff phones). Plan 22
(Law 25/PIPEDA compliance) closes the wave — it rides 18's cron infra and
20's locale plumbing, and gates production onboarding.

## Go-live gate — staging, then production

Execution order is the numbering: **14 → 15 → 16 → 17 → 18 → 19 → 20 →
21 → 22.** CI first so every later plan lands through the gate; security
and observability before real traffic; database ops once the staging DB
holds anything worth keeping; the feature wave rides the hardened
platform; i18n before compliance so plan 22's bilingual policy pages
render through plan 20's locale plumbing (and plan 18/19 templates gain
their French variants); compliance completes before a real venue signs.

**Staging go-live requires:** 14 (CI + deploy wiring + rollback rehearsed),
15 (rate limits, headers, secrets scan), 16 (health, logging, error
tracking, uptime alerts), 17 (backups with a performed restore, roles,
pooling). Plans 18–21 are validated *on* staging, not prerequisites for it.

**Production onboarding of a real venue additionally requires:** 18 and 19
(a venue's guests must actually receive PINs and confirmations), 22 in full
(published policy, consent, retention, deletion, breach procedure), 20 at
least through its guest + public workstreams (Bill 96: a QC venue's guests
must be servable in French — ops-area French can trail), and the
checklist's launch-day script executed with evidence. 21 (PWA/push) is
strongly recommended for floor-staff UX but is not a legal or safety gate.

The go/no-go checklist maps to plans as: Security → 15 (+02/AD-3/AD-7 by
construction) · Database → 17 · Rate limiting & input → 15 · Code & testing
→ 14 (CI enforcement; suites exist per §7b) · Infrastructure & monitoring →
14 + 16 · Compliance → 22. Any unchecked row at gate time carries a written,
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

Numbering continues from 23. UI sketching for new features can proceed in
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
| Multi-venue owner accounts | No tenants yet; build when a second venue of the same owner signs. |
| POS/KDS integrations, printer hardware | Integration requests must come from real customers — earn them. |
| Native apps | Plan 21 (PWA + push) covers the need without two app stores. |
| Offline mode (incl. any SW caching) | Plan 21 ships a push-only service worker; casual caching breaks deploys. No evidence of need yet. |
| RLS defense-in-depth (AD-3) | App-layer scoping + `expectTenantIsolation()` canaries hold; promote at the first external security audit. |
| Real charting lib (`mock-chart` TODO) | `mock-chart` works until a customer asks for something it can't draw. |
| Marketing email/SMS | Plans 18/19 are transactional-only; no list, and CASL consent infra for commercial messages doesn't exist yet. |
| Enforced CSP for scripts | Plan 15 ships report-only; Next's inline runtime makes enforcement its own project. |
| Metrics timeseries stack (Prometheus/Grafana/Loki) | Plan 16 defers with a named trigger: needed for *trends*, not *incidents* — Sentry + health checks cover incidents. |
| Redis-backed rate limiting | Single VPS process (AD-15); the in-memory limiter is correct for the topology. Revisit at scale-out. |
| Queue infrastructure for sends (BullMQ) | Earned by send volume; synchronous sends suffice at this scale. |
| Self-serve DSAR portal · GDPR | Plan 22 covers Law 25/PIPEDA by documented procedure; request volume doesn't justify a portal. No EU market. |
| Locales beyond fr/en, RTL, venue-content translation, locale-prefixed SEO routing | Plan 20 ships fr/en UI chrome only — the QC market's actual requirement. |

*(Formerly listed here, now planned: scheduled report email → plan 18 ·
reservation PIN delivery via SMS/email → plans 18/19 · notification
preferences UI → plan 21.)*
