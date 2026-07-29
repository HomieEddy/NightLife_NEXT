# TODO / "Not Yet Supported" Audit — 2026-07-29

Full audit of every `TODO(backend)` comment and `"Not yet supported"` runtime
stub across the codebase. This document is the implementation plan: each phase
is self-contained and can be executed independently in order.

**Audit result:** 98 markers found across 32 files. **20 were stale** (the
backend already implements the described functionality) and have been removed.
**78 remain** as genuine work items, organized below into 8 implementation
phases ordered by dependency.

---

## Stale TODOs Removed (this session)

| File | Count | Reason |
|------|-------|--------|
| `features/analytics/analytics-mock-service.ts` | 14 | All analytics depth queries (AI-01→AI-14) implemented in `analytics-depth.ts` + `/api/analytics` route |
| `features/automation/mock-service.ts` | 4 | listRules, setEnabled, updateConfig, listExecutions all implemented in `automation/core.ts` + `/api/automations/*` routes |
| `app/api/jobs/nightly-rollup/route.ts` | 1 | Code on the next line already fetches venue nightStartHour/nightEndHour/timezone |
| `app/api/jobs/report-schedules/route.ts` | 1 | Code on the next line already filters by `venueId: tenant.id` |
| **Total removed** | **20** | |

Additionally, 2 TODOs in `venue/core.ts` and 2 in `platform/guest-lookup.ts`
about hardcoded venue config fields were **fixed** — the Prisma schema already
has those columns (`compThresholdCents`, `minimumSpendWarningRatio`,
`legalCapacity`, `occupancyWarnRatio`, `coatCheckEnabled`, `doorRequiresIdCheck`),
so the code now reads from the DB row instead of hardcoding defaults.

---

## Remaining: 78 Genuine TODOs — Phased Implementation Plan

### Phase A — Tab Ledger & Financial Controls (Plan 16)
*Depends on: Plans 05, 06, 09b, 15 (all complete)*
*Risk: HIGH — money-touching code, needs tests first*

This phase turns the tab from a simple order list into a financial object with
audit trail, adjustments, and cash-out.

| # | TODO Location | What to Build |
|---|---------------|---------------|
| A1 | `ordering/live-service.ts:131` | Create `/api/tab/*` route handlers: `/api/tab/reasons` (CRUD adjustment reasons), `/api/tab/adjustments` (record comp/void/discount with reason codes), `/api/tab/sessions/{id}/transfer`, `/api/tab/sessions/{id}/merge` |
| A2 | `ordering/live-service.ts:206-218` | Implement `rushOrder()`, `compEntireOrder()`, `remakeOrder()`, `reportWalkout()` — each needs its own route handler under `/api/orders/{id}/*` |
| A3 | `platform/audit-live-service.ts:17` | Create `/api/audit` route handler — record + list venue-scoped audit entries (distinct from `/api/platform/audit` which is platform admin) |
| A4 | `platform/cashout-live-service.ts:18` | Create `/api/cashout` route handlers — preview expected drawer, record actual, compute variance, close shift |
| A5 | `guests/live-service.ts:86` | Wire `transferSession()` — plan 16 graduation, emit `SessionTransferred`/`SessionsMerged` domain events |
| A6 | `guests/live-service.ts:125` | Implement `splitBill()` — per-item assignment to sub-totals |
| A7 | `types.ts:324` | Add `reservationPin` stamp at seat time from the reservation that gated the table |
| A8 | `types.ts:506` | Add `happyHourSnapshot` column — attribution for happy-hour pricing at order time |
| A9 | `components/guest/cart-contents.tsx:392` | Payment integration placeholder — Stripe payment step before order submission |

**Verification:** Unit tests for money math (comp/void rounding, split-bill
arithmetic). Integration tests for tab adjustment → audit entry pipeline.
Preview: create session → comp an item → verify audit trail shows the entry.

---

### Phase B — Door, Guest Identity & Safety (Plan 17)
*Depends on: Plans 08, 13, 15, 16 (Phase A)*
*Risk: CRITICAL — safety and compliance features*

The door gets a real surface, guests get persistent identity, and incidents
are recorded with full compliance workflow.

| # | TODO Location | What to Build |
|---|---------------|---------------|
| B1 | `door/live-service.ts:13` | Implement entire door module (~20 methods): occupancy counter, admissions CRUD, coat check, evacuation mode, zone occupancy, group admit, refusals, lost items. Create `/api/door/*` route handlers |
| B2 | `door/waitlist-live-service.ts:12` | Implement waitlist: `listEntries()`, `join()`, `setStatus()`. Create `/api/waitlist/*` routes |
| B3 | `safety/live-service.ts:12` | Implement incidents module (~14 methods): list, report, notes, status transitions, templates, action items, zone incidents. Create `/api/incidents/*` routes |
| B4 | `sessions/live-service.ts:12` | Implement guest identity/profiles (~15 methods): profiles, bans, merges, links, referrals, data deletion. Create `/api/guests/*` routes |
| B5 | `guests/live-service.ts:114-193` | Wire remaining guest session methods: `refuseService()`, `ejectGuest()`, `createBarTab/closeBarTab/listBarTabs`, `assignHost/unassignHost/listSessionsByHost`, `getGuestSpendTonight/getTopSpendersTonight`, VIP tier benefits CRUD, `detectAbandonedSessions/autoCloseSession`, `addSessionNote/listSessionNotes`, `forceCloseSession` |
| B6 | `venue/live-service.ts:93-102` | Wire table lifecycle methods: `holdTable()`, `releaseHold()`, `markOutOfService()`, `returnToService()` — create route handlers or extend existing `/api/tables/{id}` |
| B7 | `hospitality/events-live-service.ts:71-75` | Create PATCH route for `setEventGuestStatus()` |
| B8 | `hospitality/events-live-service.ts:87-121` | Create routes for event cancellation, talent management, promoter quota |
| B9 | `hospitality/reservation-live-service.ts:87` | Wire `markNoShow` — remove the block in `reservation-core.ts:132-135` that rejects `"no-show"` (Prisma enum already has the value) |
| B10 | `hospitality/reservation-live-service.ts:94` | Create public reservation API routes (`/api/public/reservations/*`) for plan 13 graduation |
| B11 | `hospitality/reservation-live-service.ts:143-154` | Create blackout date and bump reservation API routes |
| B12 | `hospitality/reservation-mock-service.ts:214` | Implement reservation PIN delivery via email/SMS (depends on notification dispatch, plan 25) |
| B13 | `menu/core.ts:82` | Add `isAlcoholic`, `abv`, `allergens` columns to MenuItem for responsible service |
| B14 | `sessions/core.ts:16` | Add `"merged"` to Prisma `SessionStatus` enum (currently demo-track only) |
| B15 | `realtime/pulse-live-service.ts:51-57` | Wire Pulse attention methods: `acknowledgeAttentionItem()`, `snoozeAttentionItem()`, `listAcknowledgments()` |

**Verification:** Integration tests for door admission → occupancy increment,
ban enforcement at admission, incident status machine. E2E: admit guest → seat →
comp → close tab → file incident → verify audit + occupancy. Evacuation drill
test.

---

### Phase C — Workforce & Incentives (Plan 18)
*Depends on: Plans 09b, 14, 15, 16 (Phase A)*
*Risk: MEDIUM*

Time tracking, shift scheduling, tips, and commissions.

| # | TODO Location | What to Build |
|---|---------------|---------------|
| C1 | `workforce/time-live-service.ts:6` | Implement entire time tracking module (~15 methods): clock in/out, breaks, dated shifts, time off requests, shift swaps. Create `/api/workforce/time/*` routes |
| C2 | `workforce/tips-live-service.ts:6` | Implement tips module (6 methods): pool rules CRUD, distributions, tip-out calculation. Create `/api/workforce/tips/*` routes |
| C3 | `workforce/commission-live-service.ts:6` | Implement commission module (5 methods): commission rules CRUD, statements, approval workflow. Create `/api/workforce/commission/*` routes |
| C4 | `workforce/staff-live-service.ts:99-117` | Wire table assignment and handoff methods: `assignTables()`, `getTableAssignment()`, `getAssignedStaff()`, `generateHandoff()`, `acknowledgeHandoff()`, `listHandoffs()` |
| C5 | `workforce/staff-live-service.ts:120` | Implement `sendShiftReminders()` — scheduled job for upcoming shift notifications |

**Verification:** Integration tests for clock-in → break → clock-out time
calculation. Tip pool distribution math (weighted by hours worked). Commission
statement generation from reservation attribution.

---

### Phase D — Cost, Supply & Profitability (Plan 19)
*Depends on: Plans 04, 09/09c, 16 (Phase A), 18 (Phase C)*
*Risk: MEDIUM*

Suppliers, purchase orders, stocktakes, waste tracking, and margin analytics.

| # | TODO Location | What to Build |
|---|---------------|---------------|
| D1 | `platform/purchasing-live-service.ts:6` | Implement entire purchasing module (~18 methods): suppliers CRUD, purchase orders with unit costs, stocktakes with variance, 86-board management, waste tracking, profit targets, event costs, pre-/post-service checklists. Create `/api/purchasing/*` routes |
| D2 | `venue/checklist-mock-service.ts:6` | Graduate checklists: templates as venue-scoped DB rows, runs as append-only per-night records |

**Verification:** Integration tests for PO → receipt → stock movement ledger
balance. Stocktake variance calculation. Margin analytics from cost × sold
quantities.

---

### Phase E — Permissions & Role Security (Plan 15 graduation)
*Depends on: Phase A (audit trail for permission changes)*
*Risk: MEDIUM*

| # | TODO Location | What to Build |
|---|---------------|---------------|
| E1 | `platform/permission-live-service.ts:7-23` | Implement `getRolePermissions()` (from DB, not hardcoded), `setRolePermissions()`, `resetRolePermissions()`. Add `venue_role_permissions` table to Prisma schema |
| E2 | `platform/permission-mock-service.ts:12-22` | Remove stale TODO comments once E1 ships (mock keeps running for demo) |
| E3 | `shared/permissions.ts:393` | Remove TODO comment once E1 ships |

**Verification:** Integration test: set custom permissions → verify staff
endpoint enforces them → reset → verify defaults restored. Audit entry recorded
for each permission change.

---

### Phase F — Notification Dispatch (Plans 25–26)
*Depends on: Plans 02, 08, 09/09c, 13*
*Risk: MEDIUM*

| # | TODO Location | What to Build |
|---|---------------|---------------|
| F1 | `hospitality/reservation-mock-service.ts:214` | PIN delivery via email/SMS on reservation confirm |
| F2 | `app/api/reservations/[id]/status/route.ts:47` | Fix `venueName` — fetch org name via `prisma.organization` instead of passing `venueId` as the name |

**Verification:** Confirm reservation → verify email sent with correct venue
name and PIN. SMS delivery for phone-provided reservations.

---

### Phase G — Remaining Schema & Type Alignment
*Can be done incrementally alongside any phase*

| # | TODO Location | What to Build |
|---|---------------|---------------|
| G1 | `types.ts:1027` | Add `promoterId` FK to staff_profiles on Reservation |
| G2 | `types.ts:1086` | Add nullable `photoUrl` text column, validated as URL by API layer |
| G3 | `hospitality/reservation-live-service.ts:32` | Add `promoterId` filter to reservation list query |
| G4 | `hospitality/events-mock-service.ts:107` | Public events query — already wired in live-service but `/api/public/events/` route doesn't exist yet |
| G5 | `app/manager/staff/page.tsx:36-37` | Replace hardcoded `VENUE_ID = "venue-1"` with authenticated session's venueId |
| G6 | `automation/mock-service.ts:6` | Top-level comment about Coolify cron → `/api/jobs/*` — stays as documentation until cron infrastructure is deployed |
| G7 | `automation/mock-service.ts:217` | `triggerRule` is intentionally demo-only simulation — keep as-is |

**Verification:** Type-check (`tsc --noEmit`), then verify each page using the
changed field renders correctly in the preview.

---

### Phase H — Payment Integration (Stripe)
*Depends on: Phase A (tab ledger), Phase B (guest identity)*
*Risk: HIGH — money handling, PCI compliance*

| # | TODO Location | What to Build |
|---|---------------|---------------|
| H1 | `components/guest/cart-contents.tsx:392` | Stripe checkout integration — payment intent creation, card collection, confirmation before order submission |

**Verification:** Test payment flow with Stripe test keys. Verify failed payment
doesn't submit order. Verify successful payment records in audit trail.

---

## Recommended Execution Order

```
Phase A (Tab Ledger)          ─── money foundation, everything depends on this
    │
    ├── Phase B (Door/Safety) ─── most TODOs live here (largest phase)
    │       │
    │       └── Phase F (Notifications) ─── PIN delivery, alerts
    │
    ├── Phase C (Workforce)   ─── time/tips/commission
    │       │
    │       └── Phase D (Purchasing) ─── suppliers, stocktakes, costs
    │
    ├── Phase E (Permissions)  ─── role security
    │
    └── Phase H (Payments)     ─── Stripe integration
    
Phase G (Schema/Type fixes)   ─── can be done incrementally at any time
```

## Summary by the Numbers

| Phase | TODOs | New Routes | Risk | Effort |
|-------|-------|-----------|------|--------|
| A — Tab Ledger | 9 | ~8 route files | High | 2–3 weeks |
| B — Door/Safety | 15 | ~12 route files | Critical | 3–4 weeks |
| C — Workforce | 5 | ~6 route files | Medium | 2 weeks |
| D — Purchasing | 2 | ~8 route files | Medium | 2 weeks |
| E — Permissions | 3 | 1 migration + 1 route | Medium | 3–5 days |
| F — Notifications | 2 | 0 (fix existing) | Medium | 1 week |
| G — Schema/Types | 7 | 1–2 routes | Low | 3–5 days |
| H — Payments | 1 | 1 route + Stripe SDK | High | 1–2 weeks |
| **Total** | **44 unique work items** | | | **~12–16 weeks** |

Note: 78 raw TODO markers map to 44 distinct work items because many stubs
in the same live-service file are part of the same feature implementation.
