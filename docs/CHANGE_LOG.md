# Change Log — Documentation Realignment (2026-07-27)

## Summary

Comprehensive documentation realignment following a business logic audit and a
new strategic direction. All planning documents updated to reflect:

1. **Business Logic First** — operational workflows complete before infrastructure.
2. **PWA as first-class delivery target** — installable, offline-capable mobile
   experience for staff and guests.
3. **Push notifications** — complete notification system with Web Push API,
   email, and SMS, 20 operational triggers, per-user preferences, and event-driven
   dispatch.
4. **CI/CD deferred to Phase 7** — build and deploy automation ships only after
   the product is functionally complete through Phase 6.

---

## Document-by-Document Changes

### `docs/ROADMAP.md` — REWRITTEN

| Change | Detail |
|---|---|
| **Structure** | Restructured from single-sequence list (plans 01–29) to 7-phase roadmap with phase objectives, features, dependencies, and exit criteria |
| **Phase 1** | Consolidates plans 01–15 as "Core Platform Foundation." Marks 01–12 complete, 13 demo-complete, 14–15 in demo track |
| **Phase 2** | Plans 16–17 (tab + door), plans 25–26 (notifications), plus 4 new safety features (S-01→S-04) as "Core Nightclub Operations" |
| **Phase 3** | Plans 18–20 (workforce, cost, navigation) + 88 new operational features (RV-01→RV-21, OE-01→OE-35, CRM-01→CRM-07) as "Business Logic Completion" |
| **Phase 4** | 14 analytics features (AI-01→AI-14) + 13 automation features (AM-01→AM-13) as "Automation & Intelligence" |
| **Phase 5** | Plan 28 expanded to 8 PWA features (PWA-01→PWA-08) + 9 push notification features (PSH-01→PSH-09) + 20 operational notification triggers as "Mobile Experience" |
| **Phase 6** | Plans 22–24, 27, 29 consolidated as "Production Readiness" |
| **Phase 7** | Plan 21 moved here + 17 new deployment/operations features (DPL-01→DPL-10, OPS-01→OPS-07) as "CI/CD, Deployment & Release Automation" |
| **Notifications** | Plans 25–26 moved from Phase 6 to Phase 2 — notification dispatch is product infrastructure, not operations infrastructure |
| **CI/CD** | Plan 21 deferred from its original position (after plan 20) to Phase 7. Minimal CI (PR lint+typecheck+test) permitted during development |
| **Feature codes** | New feature coding system: S (safety), RV (revenue), OE (operations/efficiency), CRM, AI (analytics/intelligence), AM (automation), PWA, PSH (push), DPL (deployment), OPS (operations) |
| **Dependency map** | Updated to show phase-level dependencies and the notification dispatch layer feeding Phases 3–7 |
| **Parking lot** | Preserved with minor additions (offline mode beyond Phase 5 queue, enforced CSP) |
| **Definition of done** | Extended to cover demo-track features (feature codes) vs live graduation (plan numbers) |

### `docs/PRD.md` — REWRITTEN

| Change | Detail |
|---|---|
| **Status header** | Updated to reflect re-aligned roadmap and new last-updated date |
| **Section 1** | Added PWA and push notification positioning. Updated surface descriptions for all 7 staff roles |
| **Section 2 (Users)** | Expanded from 7 to 12 user roles. Added: Floor Manager, VIP Host, Bar Lead, Security Lead, Door Host (split from Host/Security). Updated all job descriptions |
| **Section 3 (Phases)** | Replaced "Why a backend now" with 7-phase product phase summaries |
| **Section 4 (Scope)** | In scope now includes all Phase 2–5 features. Out of scope updated (native apps replaced by PWA, multi-venue stay deferred) |
| **Section 5 (Requirements)** | Extended from 14 to 18 requirements. Added: R15 (event-driven notifications), R16 (mobile-first staff PWA), R17 (offline resilience), R18 (cross-module workflows as single actions) |
| **Section 6 (Success criteria)** | Extended with PWA-specific criteria (Lighthouse ≥ 90), push notification criteria, promoter workflow criteria, incident workflow criteria |
| **Section 7 (NFRs)** | Added push latency < 3s, PWA load < 3s on 4G, SW size < 100 KB, offline queue |
| **Section 8 (Rollout)** | Updated sequence to match new phases |
| **Title/header** | Changed from "PRD — NightLifeNext Backend" to "PRD — NightLifeNext" (this is the full product PRD now, not just the backend migration) |

### `docs/ARD.md` — EXTENDED

| Change | Detail |
|---|---|
| **AD-19** | New: PWA architecture — Service Worker, app shell, offline queue, update lifecycle, Web App Manifest, Lighthouse targets |
| **AD-20** | New: Push notifications — Web Push API, VAPID keys, subscription management, notification preferences, quiet hours, Service Worker push handler |
| **AD-21** | New: Rules engine — shared condition-action evaluator, `src/server/rules/`, declarative config, typed rule types, notification/escalation/block/auto-adjust actions |
| **AD-22** | New: Notification dispatch — one dispatcher, three channels (email/SMS/push), `NotificationLog`, idempotency, retry with backoff |
| **AD-23** | New: CI/CD deferral — minimal dev CI only during Phases 1–6; full automation in Phase 7. Principle: automate delivery of a complete product |
| **AD-16** | Extended: audit trail now covers `notification_logs` and `compliance_actions` |
| **AD-17** | Extended: guest identity now covers watchlist, preferences, celebrations, linked profiles, staff notes, guest photo |
| **System sketch** | Updated to include rules engine, notification dispatcher with 3 channels, and PWA Service Worker in the browser layer |
| **Header** | Updated last-updated date and description of new ADs |

### `docs/DDD.md` — EXTENDED

| Change | Detail |
|---|---|
| **Section 1 (Bounded contexts)** | Expanded diagram. New contexts: Guest Identity & CRM (extended from basic profiles), Notifications, Compliance, PWA Infrastructure, Rules Engine |
| **Section 2 (Aggregates)** | 35+ new invariants: INV-O7–O9 (priority, SLA, auto-gratuity), INV-S5–S7 (split-bill, minimum progress, transfer chain), INV-I4–I7 (cost, waste, transfer, par), INV-V3–V4 (capacity-aware booking, cover schedule), INV-F2 (evacuation), INV-W6–W11 (overtime, late, no-show, certification, staffing, briefing), INV-R1–R5 (time-slotted reservations, deposit, cancellation, hold), INV-E1–E2 (guest-list capacity), INV-D4–D12 (age, watchlist, denied entry, ejection, evacuation, compliance, CCTV, action items), INV-G4–G10 (preferences, celebrations, watchlist, photo, RFM, linked profiles, referral), INV-N1–N4 (notification preferences, idempotency, push subscriptions, quiet hours), INV-C1–C3 (certification, compliance items, mandatory reports), INV-C6 (auto-suggested PO) |
| **Section 3 (Domain events)** | Extended from ~30 to ~100 events, organized by phase. 60+ new events for Phases 2–6 |
| **Section 5 (Ubiquitous language)** | 11 new terms: watchlist, ejection, auto-gratuity, split-bill, RFM, quiet hours, offline queue, app shell, denied entry, manual 86 vs auto-86, business date clarification |
| **New aggregates** | `Recipe`, `CoverPriceRule`, `Certification`, `ComplianceItem`, `MandatoryReport`, `NotificationPreference`, `NotificationLog`, `PushSubscription`, `GuestPreference`, `GuestNote`, `GuestProfileLink`, `GuestReferral`, `WitnessStatement`, `IncidentActionItem`, `CctvReference`, `RuleDefinition`, `BriefingNote`, `SplitParticipant` |

### `docs/BUSINESS-LOGIC-GAP-REVIEW.md` — SUPERSEDED

| Change | Detail |
|---|---|
| **Header** | Added "SUPERSEDED. Historical document." banner with date and cross-references to new roadmap |
| **Content** | Original content preserved but framed as historical. All findings mapped to plans 16–29; new gaps from 2026-07-27 audit mapped to Phases 2–5 |

### `AGENTS.md` — UPDATED

| Change | Detail |
|---|---|
| **§9 title** | Changed from "Phase 2 — backend migration playbook" to "Product strategy & graduation playbook" |
| **§9 intro** | Added product strategy summary: seven-phase roadmap, Business Logic First, PWA as primary staff target, push notifications as first-class feature |
| **§9 reference** | Added explicit pointer to `docs/ROADMAP.md` (2026-07-27) as the master roadmap |

### New Documents Created

| Document | Purpose |
|---|---|
| `docs/CHANGE_LOG.md` | This file. Summary of all modifications with document-by-document detail |
| `docs/TRACEABILITY.md` | Maps every business logic gap from the 2026-07-27 audit to the PRD requirement, ARD decision, DDD invariant, and roadmap phase where it is addressed |

---

## Consistency Verification

All documents now agree on:

- **Feature priorities**: Business logic (Phases 2–3) → automation (Phase 4) → mobile (Phase 5) → production readiness (Phase 6) → CI/CD (Phase 7)
- **Release order**: Foundation complete → Core Ops → Business Logic Completion → Automation/Intelligence → PWA/Push → Production Readiness → CI/CD
- **Milestones**: Phase boundaries clearly defined with exit criteria in ROADMAP.md
- **Dependencies**: Notification dispatch (plans 25–26) in Phase 2, feeding all subsequent phases. Plan 20 (navigation) alongside Phase 3 features. Phase 6 gates real-venue onboarding.
- **Business rules**: 18 PRD requirements, 23 ARD decisions, 80+ DDD invariants — all consistent
- **User roles**: 12 roles consistent across PRD §2, DDD bounded contexts, and roadmap features
- **Architecture**: AD-14 dual-mode, AD-19 PWA, AD-20 push, AD-21 rules engine, AD-22 notification dispatch, AD-23 CI/CD deferral — internally consistent
- **Domain terminology**: Ubiquitous language consistent across PRD, ARD, and DDD

### Resolved Contradictions

| Prior contradiction | Resolution |
|---|---|
| Plan 25 (email) in production-readiness wave vs needed by earlier features | Moved to Phase 2 — notification dispatch is product infrastructure, not ops infrastructure |
| Plan 21 (CI/CD) before security/observability/DB ops | Moved to Phase 7 — CI/CD ships after functional completeness |
| `BUSINESS-LOGIC-GAP-REVIEW.md` as living reference vs 2026-07-27 audit findings | Gap review marked as superseded; new 88-feature audit is the authority for product gaps |
| PWA (plan 28) as a single feature vs full mobile strategy | Plan 28 expanded to 17 features (8 PWA + 9 push) in Phase 5 |
| "Phase 2" meaning backend migration vs new product phase | AGENTS.md §9 renamed. ROADMAP.md now defines phases 1–7 unambiguously |
| No rules engine AD vs 20+ condition-action features planned | AD-21 added: shared rules engine for all condition-action features |

---

## Total Changes

| Metric | Count |
|---|---|
| Documents modified | 6 |
| New documents created | 2 |
| Architecture decisions added | 5 (AD-19 through AD-23) |
| PRD requirements added | 4 (R15 through R18) |
| DDD invariants added | 35+ |
| Domain events added | 60+ |
| New feature codes | 9 categories (S, RV, OE, CRM, AI, AM, PWA, PSH, DPL, OPS) |
| User roles expanded | 7 → 12 |

---

## Documentation Consistency Reconciliation (2026-07-27)

Following a 42-document cross-document consistency audit, 17 findings (F01–F17)
were resolved across governing documents and plans. Key changes:

### Payment scope (F01)

- PRD R9 and §4 out-of-scope: clarified Stripe is exclusively for SaaS tenant
  subscription billing — no guest or venue payment processing.
- ARD AD-12: expanded scope description; system sketch updated.
- DDD Platform context: bounded context diagram updated.
- HOSTING.md: environment table and privacy section updated.
- Plan 10: title and goal updated; payment scope boundary added.

### Safety specification (F02, F04, F13)

- Plan 17: added S-01 age verification enforcement, S-02 mandatory incident
  reporting compliance, S-03 emergency evacuation workflow, S-04 certification
  tracking, and S-13 legal capacity enforcement with blocking admission
  and audited override.
- ROADMAP: S-04 dependency moved from Plan 18 (Phase 3) to Plan 17 (Phase 2).
- Plan 17 capability matrix: added safety capability rows (`emergency:evacuate`,
  `door:admit-capacity-override`, `incident:mark-reportable`,
  `certification:manage`, `guest:watchlist`).

### PWA/offline reconciliation (F03, F08)

- Plan 28: scope expanded from push-only to full PWA per AD-19 (cache-first
  app shell, offline action queue with `commandId`-based idempotency, identity
  binding, sensitive-data restrictions, conflict-recovery UI, update lifecycle).
- ARD AD-19: offline queue specification added with idempotency keys, server
  replay rules, identity binding, sensitive-data restrictions, queue expiry,
  and conflict recovery.
- ROADMAP parking lot: offline mode entry updated.

### Notification domain contract (F06)

- Plan 28: `NotificationPreferences` model changed from flat booleans to
  `NotificationPreference: { channel, eventType, enabled }[]` array model
  matching AD-20 and DDD INV-N1. Guest push added (per-session subscriptions).
- Plan 25: preferences UI deferral note updated — UI ships in Plan 28.
- ARD AD-22: preferences model reference updated to canonical AD-20 model.

### Role-capability matrix (F07)

- PRD §2: five sub-role specializations defined (Floor Manager, VIP Host,
  Bar Lead, Security Lead, Door Host) as permission sets on base roles.
- Plan 15: sub-role specialization definitions added to capability matrix.
- ARD AD-4: base roles vs sub-role specializations clarified.

### Privacy minimums (F09)

- Plan 17: privacy minimum section added (no document images, opt-in profiles,
  retention labels, tenant isolation on PII tables).
- HOSTING.md: external service integration disclosure added.

### Architecture fixes (F10, F12, F14)

- ARD AD-21: `autoAdjust` and `block` restricted to transaction-committed
  evaluation points only; reads produce `warn`/`escalate`/`notify` only.
- Plan 18: TimeEntry break handling clarified — breaks create superseding
  rows in the append-only ledger.
- Plan 19: canonical P&L formula defined as single source of truth for
  profitability math, with explicit comp-handling (subtract once in
  contribution, never in netRevenue).

### Stale plan reconciliation (F05, F15, F16, F17)

- Plan 21: status and preconditions updated to reflect Phase 7 deferral.
- Plan 01: Testcontainers replaced with PGlite; app mode default updated
  to require explicit setting.
- Plan 03: mock rename proposal removed.
- Plan 12: `@testcontainers/postgresql` devDependency reference removed.
- Plan 14: CRM out-of-scope reference updated to reference Plan 17.
- Plan 20: guest in-flight order status strip, gift entry point, and receipt
  entry point added (UX finding 11).
- Plan 11: "Ember" terminology purged from post-review content; CSS naming
  convention retention clarified.
- TRACEABILITY.md: coverage status assertion updated.
| Roadmap phases | 7 (was single-sequence list of 29 plans) |
