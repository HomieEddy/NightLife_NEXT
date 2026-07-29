# ARD — Architecture Requirements & Decisions

**Status:** Living document · Companion to `docs/PRD.md` and `docs/DDD.md`.
**Last updated:** 2026-07-27. Phase 2 shipped plans 01–12; decisions below are
implemented unless an "Implementation status" note says otherwise. AD-19 through
AD-23 are new — they govern Phases 3–5 of the re-aligned roadmap.

Each decision: context → choice → alternatives considered → consequences. These are
defaults, not dogma — overturn one by editing this file in the same PR that departs
from it (AGENTS.md §9.9).

---

## AD-1 · Runtime: stay inside Next.js

**Choice:** One Next.js 16 app. Backend = route handlers under `src/app/api/` +
server actions for form-shaped mutations. No separate API service.

**Consequences:** Deployment stays one unit. The mock-service seam maps 1:1.
Long-lived work (report scheduler, Stripe webhooks) also fits.

---

## AD-2 · Database: PostgreSQL + Prisma

**Choice:** PostgreSQL 17 + Prisma ORM. Self-hosted on OVHcloud (BHS, QC) via
Coolify per AD-15. PGlite in-process for local dev and integration tests.

**Consequences:** `prisma/schema.prisma` is the source of truth. `types.ts`
derives from generated types. Migrations via `prisma migrate`.

---

## AD-3 · Multi-tenancy: shared schema, `venueId` column, central enforcement

**Choice:** One database, one schema; every tenant table carries `venueId`.
Scoping enforced centrally with a Prisma client extension that injects
`where: { venueId }` from session context.

**Consequences:** R2 becomes testable. `/admin` uses the unscoped client behind
the platform role. RLS deferred as defense-in-depth (roadmap parking lot).

---

## AD-4 · AuthN/AuthZ: Better Auth

**Choice:** Better Auth with organization plugin. Venue = organization. Base
roles = manager/host/bartender/runner/security/promoter + platform admin.
Five sub-role specializations (floor-manager, vip-host, bar-lead,
security-lead, door-host — defined in the capability matrix as permission
sets on base roles, not separate auth roles). Guest access via signed table
QR tokens (JWT-style, secret-signed, revocable).

**Consequences:** Replaces mock auth service. Route handlers read session → role →
scoped Prisma client. Simulations gated behind `isDemoMode()`.

---

## AD-5 · Money: integer cents, server-computed

**Choice:** All money stored as integer cents. Server computes subtotal, fees,
tips, auto-gratuity, comp/void/discount in one transaction. Clients send intents,
never prices.

**Consequences:** The single most important correctness decision. Σ(fee lines) +
subtotal + tip === total exactly in cents. Auto-gratuity rules (Phase 3) compute
server-side in the same settlement transaction.

---

## AD-6 · Realtime: SSE first, Postgres NOTIFY as the bus

**Choice:** SSE (`GET /api/live`) per surface scope. Publish via Postgres
`LISTEN/NOTIFY`. `useLiveEvents` hook with polling fallback. Push notifications
(AD-21) are a separate channel for off-device delivery.

**Consequences:** All polling TODOs collapsed into one mechanism. Domain events
are the only things published on NOTIFY. Push events use the same domain event
vocabulary but route through the notification dispatcher (AD-22).

---

## AD-7 · Validation & contracts: Zod at every boundary

**Choice:** Zod schemas per route handler/server action input. Schemas live beside
the handler. Service-layer methods keep TypeScript signatures (R1).

---

## AD-8 · Email: Resend + React Email

**Choice:** Resend for transactional mail via the notification dispatcher (AD-22).
Templates in React Email. Dev mode logs to console.

**Implementation status:** not landed. Ships with plan 25 (Phase 2).

---

## AD-9 · Background work: platform cron + idempotent jobs

**Choice:** Scheduled triggers via Coolify cron hitting authenticated route handlers:
`/api/jobs/report-schedules`, `/api/jobs/nightly-rollup`, `/api/jobs/reservation-hold-expiry`,
`/api/jobs/session-timeout`, `/api/jobs/certification-expiry`, `/api/jobs/compliance-deadline`.
Jobs are idempotent; `job_runs` table prevents double-execution.

**Implementation status:** partial. `job_runs` model exists but no handlers or cron
wiring. Ships with plan 25 (Phase 2). Additional job handlers added in Phase 3
(automations) and Phase 4 (auto-release, auto-escalation).

---

## AD-10 · Testing infrastructure

**Choice:** Vitest for unit + integration. Integration tests hit route handlers
against PGlite in-process. Playwright for E2E flows. Mock-data literals are seed
fixtures.

---

## AD-11 · Analytics: SQL over orders, rollup table for history

**Choice:** Tonight queries aggregate live orders. Historical ranges read
`nightly_rollups`. Report engine composes same queries. CSV export rendered
server-side; scheduled runs delivered via notification dispatcher (AD-22).
Phase 4 adds comparison queries (night-over-night), projection queries, and
SLA analytics on the same data.

---

## AD-12 · Tenant billing: Stripe subscriptions (SaaS only)

**Choice:** Stripe Checkout + customer portal for tenant SaaS plan billing.
No guest payment processing — the app computes amounts owed (order totals,
tips, auto-gratuity, cover charges, deposit amounts) but never collects them.
Stripe webhooks sync subscription state for tenant provisioning and plan
limits; no Stripe Connect, no guest-facing Checkout, no payment intents.

---

## AD-13 · Environments & config

**Choice:** `dev` (PGlite in-process), `preview` (OVHcloud staging), `prod`
(OVHcloud production). All secrets via env vars, validated at boot with Zod.
`NEXT_PUBLIC_APP_MODE` required — parse failure aborts boot (fail-closed).

---

## AD-14 · Dual-mode: the mock demo is a permanent product surface

**Choice:** Mock and real implementations co-exist. Contract from the mock
(`type XService = typeof mockXService`). Selector layer
(`src/features/{domain}/services.ts`) picks via `NEXT_PUBLIC_APP_MODE`. Demo build on Vercel, live build on OVHcloud.
Same repo, two deploy targets. Build-time inlining drops unused implementation.

**Demo-first lifecycle:** Sketch mock-first → iterate UX in demo → gate behind
`isDemoMode()` → graduate with real implementation satisfying mock type.

**Consequences:** All new features (RV, OE, CRM, AI, AM, PWA, PSH feature codes)
follow this lifecycle. Mocks remain seed/fixture source AND shipped product.

---

## AD-15 · Hosting: Vercel (demo) + OVHcloud BHS/Coolify (staging & prod)

**Choice:** Demo on Vercel (stateless, free tier, global CDN). Staging and
production on OVHcloud VPS (Beauharnois, QC) via Coolify (git-push deploys,
Docker orchestration, separate Postgres instances).

**Consequences:** Quebec hosting satisfies PIPEDA + Law 25 data residency.
No cross-border PII transfer. Coolify provides deployment management.

---

## AD-16 · Accountability: one audit trail, ledgers everywhere

**Choice:** One `audit_entries` table, venue-scoped, append-only. Written inside
the same transaction as every sensitive effect. Ledger discipline is the default:
`tab_adjustments`, `occupancy_events`, `admissions`, `time_entries`,
`tip_distributions`, `commission_statements`, `incident_notes`,
`notification_logs`, `compliance_actions` — all INSERT-only.

**Consequences:** "Who did what when" is one query. Plan 29 retention has one
obvious source. Reversal/supersede chain encoded once in pure functions.

---

## AD-17 · Guest identity: opt-in, pseudonymous by default

**Choice:** Profiles created only where identity was given. Anonymous QR path
creates no profile. ID checks record the check, never the document. Consent is
per-channel and explicit. Bans are venue-local. Phase 3 adds watchlist tier
(separate from ban), guest preferences, celebration dates, linked profiles,
staff notes, and guest photo — all on the same opt-in profile model.

**Consequences:** Law 25 exposure is proportional. Cross-tenant lookup impossible
by construction. Recognition features degrade gracefully when no profile exists.

---

## AD-18 · Product cost: weighted average, carried on the movement

**Choice:** Weighted average cost (WAC). `unitCostCents` on each inbound
`StockMovement`. `MenuItem.avgCostCents` recomputed on each receipt. Phase 4
adds auto-calculated pour cost from recipe BOM + current cost.

**Consequences:** Pour cost and margin computable from movements alone. Historical
margin does not retroactively change when a new shipment arrives.

---

## AD-19 · PWA: app shell, service worker, offline queue

**Context:** Mobile is the primary staff interface. Security, hosts, runners,
and bartenders work from phones, often in areas with poor connectivity
(basements, thick walls, crowded networks). The PWA must provide an app-like
experience with resilience to brief connectivity loss.

**Choice:**
- **Service Worker**: one SW at `/sw.js`, cache-first for app shell (HTML, CSS,
  JS bundles), network-first for API data. SW size target < 100 KB.
- **App Shell**: `app-shell.tsx` wraps all staff/guest surfaces. Shell renders
  instantly from cache; data fills in from network. Skeleton states shown while
  fetching.
- **Offline Queue**: `src/lib/offline-queue.ts` — a localStorage-backed queue for
   user actions (place order, file incident, clock in/out, admit guest) taken
   while offline. Each queued action carries a `commandId` (cuid-generated) for
   server-side idempotency — replaying the same command produces the same result.
   Actions are identity-bound to the session active at queue time; if the session
   changes on reconnect (different user, expired token), queued actions are
   rejected with a recovery prompt, never silently replayed under a new identity.
   Sensitive payloads (document images, full DOB, ID numbers) are never written to
   localStorage — door admission payloads carry only admission type, party size,
   and profile ID references. Queue replays in order on reconnect; failed replays
   surface in a user-facing recovery banner with per-item retry/skip controls.
   Queue expiry: actions older than 24 hours are discarded on next sync attempt
   (a nightclub shift doesn't span days). Conflict recovery: if server state has
   changed (e.g. order item no longer available), the action is marked `failed`
   with the server error, not silently discarded.
- **Offline Indicator**: persistent banner when `navigator.onLine === false`.
  Non-critical actions (browsing menu, viewing history) remain available.
  Critical actions (door admission, incident filing) available via offline queue.
- **Update Lifecycle**: SW checks for updates on navigation. If new version
  available, show banner "New version available — tap to refresh." Never
  auto-refresh during active use (a floor manager mid-order at 1 AM must not be
  interrupted).
- **Web App Manifest**: `manifest.json` with themed splash screen, standalone
  display mode, venue-branded icons.
- **Lighthouse target**: PWA score ≥ 90, Performance ≥ 90, Accessibility ≥ 95.

**Alternatives:** native apps (two app stores, two codebases, install friction —
  a PWA covers every need without these costs); full offline mode with SW
  caching all data (breaks deploys, no evidence of need — offline queue is the
  right 80/20 cut); React Native (ecosystem lock-in, separate deployment pipeline).

**Consequences:** Every new staff/guest surface is mobile-first. Desktop/tablet
is a progressive enhancement. Offline queue action types must be explicitly
registered (not all actions are queueable). SW update cycle must be tested
across all staff roles. The SW is push-only (plan 28 scope: push notifications +
offline queue; full SW caching of application data is deferred).

---

## AD-20 · Push notifications: Web Push API + notification dispatcher

**Context:** Staff need real-time alerts without keeping a browser tab open.
Guests want order-status updates. Push notifications are the delivery channel
for alerting users who aren't actively looking at the dashboard.

**Choice:**
- **Push subscription**: `PushSubscription` stored per user. `POST
  /api/push/subscribe` and `/api/push/unsubscribe` endpoints. Token rotation
  handled on `pushsubscriptionchange` event.
- **Notification preferences**: `NotificationPreferences` per user:
  `{ userId, channel: "push"|"email"|"sms", eventType, enabled }`. Stored in
  Postgres. User controls via `/manager/settings/notifications` and
  `/staff/settings/notifications`.
- **Quiet hours**: `{ startTime, endTime, timezone }` per user. Non-critical
  notifications suppressed during quiet hours.
- **Delivery**: the notification dispatcher (AD-22) routes to push when the
  recipient has an active `PushSubscription` and push is enabled for the event
  type. Push delivery uses the Web Push protocol with VAPID keys.
- **Payload**: minimal JSON payload (`{ type, title, body, url, icon }`).
  The PWA's service worker receives the push event and shows a system
  notification. Tapping the notification navigates to the relevant URL.
- **Service Worker scope**: push event handler in the same SW that handles
  caching (AD-19). SW `push` event listener shows `self.registration.showNotification()`.
- **VAPID keys**: generated once, stored in env vars (`VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`). Public key embedded in the app for subscription.

**Alternatives:** Firebase Cloud Messaging (adds Google dependency, unnecessary
  for web-only push — Web Push API is standardized and works everywhere FCM
  does for web); third-party push service (OneSignal/Pusher Beams — per-MAU
  pricing, vendor lock-in); SMS as primary push channel (cost per message,
  guest phone collection friction, slower delivery).

**Consequences:** Push is the third channel in the notification dispatcher
(AD-22), alongside email (AD-8) and SMS (plan 26). Push subscriptions must be
tested across browsers (Chrome, Safari, Firefox — Safari requires the PWA to be
"added to home screen" for push). Browser permission prompt timing is critical:
request on first meaningful interaction, not on page load.

---

## AD-21 · Rules engine: shared condition-action evaluator

**Context:** The business logic audit identified 20+ features that are
"when condition X, fire action Y" — auto-gratuity rules, cover price schedules,
comp thresholds, SLA timers, capacity warnings, minimum-spend checkpoints,
overtime alerts, break compliance, certification expiry, compliance deadlines,
deposit forfeiture, reservation hold expiry, pour-cost targets, variance
thresholds. Building N separate if-blocks across N services is the pattern
AGENTS.md §1.2 warns against.

**Choice:**
- **`src/server/rules/` module** with three parts:
  1. **Rule definitions**: declarative config stored in Postgres (`rule_definitions`
     table: `{ id, venueId, ruleType, condition, action, priority, active }`).
     Many rules are venue-configurable (auto-gratuity %, SLA minutes, comp
     thresholds). A few are hardcoded system rules (order state machine transitions).
  2. **Rule evaluator**: `evaluateRules(venueId, ruleType, context) → Action[]`.
     For a given event type (e.g. `order:placed`), evaluates all active rules of
     that type against the context (order, session, venue config), returns
     actionable results.
  3. **Rule types**: each rule type is a typed union — `AutoGratuityRule`,
     `SlaThresholdRule`, `CompThresholdRule`, `CapacityWarningRule`,
     `MinimumSpendCheckpointRule`, `OvertimeAlertRule`, `BreakComplianceRule`,
     `CertificationExpiryRule`, `ComplianceDeadlineRule`, `DepositForfeitureRule`,
     `ReservationHoldRule`, `PourCostTargetRule`, `VarianceThresholdRule`,
     `CoverPriceScheduleRule`.
- **Evaluation points**: rules are evaluated at well-defined trigger points:
   - On data mutation (order placed, session closed, clock-in, stock received) —
     **state-changing actions (`autoAdjust`, `block`) are restricted to
     transaction-committed evaluation points only.** A read (e.g. Pulse feed
     query) must only produce derived warnings (`notify`, `escalate`, `warn`),
     never trigger monetary ledger changes.
   - On schedule (cron job checks certification expiry, compliance deadlines,
     reservation holds)
   - On query (Pulse feed evaluates SLA, capacity, minimum-spend rules — but
     only produces `warn`/`escalate`/`notify` actions, never
     `autoAdjust` or `block`)

**Alternatives:** inline if-blocks per feature (what we'd have without this AD —
  20 copies of the same pattern, tested 20 times); external rules engine
  (Drools/OpenPolicyAgent — massive overkill for configuration-driven business
  rules with no regulatory compliance engine requirement); no abstraction at
  all (YAGNI — but 20 features all needing the same shape IS the threshold for
  extracting the pattern).

**Consequences:** Rules are testable in isolation: `evaluateRules(venueId, "auto-gratuity",
{ session, orders }) → [{ action: "notify", ... }]`. Adding a new rule type is
adding a config shape and an evaluator function; the dispatch is shared. Venue
admins can configure thresholds without code changes.

---

## AD-22 · Notification dispatch: one dispatcher, three channels

**Context:** The product needs to send email (plan 25), SMS (plan 26), and push
notifications (Phase 5). Building channel logic in each feature would produce
three parallel seams with different error handling, retry, and logging.

**Choice:**
- **`src/server/notifications/dispatch.ts`** — `notify(event, recipients, payload)`:
   resolves channels per recipient from `NotificationPreferences` (canonical
   model per AD-20: `NotificationPreference: { channel, eventType, enabled }[]`),
   calls the appropriate transport (`email.ts`, `sms.ts`, `push.ts`), records one
   `NotificationLog` row per attempt (idempotent: keyed by (eventId, recipientId,
   channel) — never double-send the same notification).
- **Transports** are thin adapters:
  - `email.ts` → Resend (AD-8)
  - `sms.ts` → Twilio (plan 26)
  - `push.ts` → Web Push API (AD-20)
- **Templates**: `src/notifications/templates/*.ts` — typed template functions
  that take a typed payload and return `{ subject?, body, html? }`. One template
  per event type per channel. Not React Email (email) + plain text (SMS/push).
- **Logging**: `NotificationLog: { id, venueId, channel, template, recipientId,
  recipientAddress, status: "sent"|"delivered"|"failed"|"clicked", providerId,
  error?, createdAt }`. Append-only. The log IS the delivery audit trail.
- **Failure handling**: per-transport retry with exponential backoff (max 3
  retries over 10 minutes). After 3 failures, log as "failed" and do not retry.
  The `NotificationLog` is queryable for failed sends.
- **Queue topology**: BullMQ (Redis-backed) in staging/prod for reliable retry
  and scheduled sends; cron-job fallback for local live dev (`dev:pglite`,
  `dev:stack`) — no Redis dependency for local development. Plan 30 §3 is the
  implementation vehicle.

**Alternatives:** per-feature notification logic (three code paths, three error
  models, no cross-channel preferences — rejected per AGENTS.md §1.2).

**Consequences:** Adding a new notification trigger is: (1) define the domain
event if new, (2) create a template, (3) call `notify(...)` at the trigger point.
The dispatcher handles channel resolution, preferences, logging, and retries.
All features in Phases 2–5 that say "notify X when Y" route through this one
function.

---

## AD-23 · CI/CD deferral: minimal development CI, full automation in Phase 7

**Context:** The product roadmap defers production-grade CI/CD, deployment
automation, infrastructure-as-code, and release orchestration to Phase 7 —
after the product is functionally complete through Phase 6. This AD records
the decision so it is not relitigated per feature.

**Choice:**
- **During Phases 1–6 (development):** one minimal CI gate on every PR to `dev`:
  `npx tsc --noEmit && npx eslint src && npm run test`. No staging deploys, no
  production pipelines, no Docker optimization, no Kubernetes, no Coolify
  automation beyond git-push deploys. Manual deploys via Coolify dashboard are
  acceptable for development velocity.
- **Phase 7 (post-functional-completeness):** full CI/CD pipeline: GitHub Actions
  with lint → typecheck → test → integration test gates; automated staging
  deploy on merge to `dev`; automated production deploy on merge to `master`
  with manual approval gate; blue-green deploy strategy; database migration
  automation; rollback rehearsed and documented; infrastructure-as-code
  (Coolify config versioned in repo); disaster recovery runbook tested quarterly.
- **Principle**: automate the delivery of a complete product, not a
  work-in-progress. Engineering cycles spent on deploy automation in Phase 2
  are cycles not spent on the tab ledger or door surface — and those are what
  make the product sellable. CI/CD is valuable, but it's valuable because it
  delivers features faster; if there are no features, there's nothing to deliver.

**Alternatives:** shipping CI/CD early (plan 21's original position) — rejected
  because the re-aligned strategy is "business logic first"; build pipelines
  alongside features (incremental CI/CD) — tempting but each pipeline increment
  creates maintenance burden while the product surface changes rapidly.

**Consequences:** The team manually deploys via Coolify during Phases 1–6. PR
gates are automated (tsc, eslint, test). Staging validation is manual. This
is acceptable because the number of deploy targets is small (staging, production,
demo) and the team is small.

---

## System sketch (updated for Phase 2–5)

```
Browser / PWA (manager / staff / guest / admin UIs)
   │  imports from src/features/{domain}/services.ts selectors (AD-14)
   │  Service Worker: cache-first app shell + offline queue + push events (AD-19/20)
   ▼
xService = demo → mockXService (in-memory, self-resetting)
           live → realXService → fetch / server actions
   ▼
Next.js route handlers + server actions
   ├─ Zod input validation (AD-7)
   ├─ Better Auth session → role checks (AD-4)
   ├─ Rules engine evaluates triggers (AD-21) ──► actions (notify/escalate/block/autoAdjust)
   ├─ scoped Prisma client (venueId injected, AD-3)
   │       ▼
   │   PostgreSQL ── append-only ledgers, integer cents, LISTEN/NOTIFY
   ├─ SSE /api/live ◄── NOTIFY fan-out (AD-6)
   ├─ Notification dispatcher (AD-22)
   │     ├─ Resend (email, AD-8)
   │     ├─ Twilio (SMS, plan 26)
   │     └─ Web Push API (push, AD-20)
   ├─ Cron job handlers (AD-9) ── idempotent, Coolify-triggered
    ├─ Stripe webhooks — tenant subscription sync only, no guest payments (AD-12)
   └─ audit_entries (AD-16) ── written in-transaction with every sensitive effect
```

Append-only ledgers, in one place (AD-16): `stock_movements`, `tab_adjustments`,
`occupancy_events`, `admissions`, `time_entries`, `tip_distributions`,
`commission_statements`, `incident_notes`, `notification_logs`, `lead_activity`,
`chat_messages`, `broadcasts`, `sold_out_events`, `domain_events`, `audit_entries`.
