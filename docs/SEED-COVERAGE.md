# Seed Coverage Matrix

Generated 2026-07-31. Maps every shipped feature to its demo seed data,
live seed data, and the page that proves it.

## Legend

- `✓` — fully seeded with realistic data
- `partial` — some data exists but gaps remain
- `—` — no seed data exists
- `N/A` — model has no migration / feature has no UI

## Models with no migration (BLOCKER)

| Model | Schema line | Status |
|---|---|---|
| `NotificationLog` | schema line 1809 | **No CREATE TABLE in any migration** — must add migration before seeding |

## Feature coverage

### Phase 1–2: Foundation (Venue, Zones, Tables, Staff)

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| Tenant | — (demo in-memory) | ✓ `seed.ts` | — | — |
| Organization | — | ✓ `seed.ts` | — | — |
| User + Session + Account | — | ✓ `seed.ts` (10 users) | — | — |
| Member | — | ✓ `seed.ts` (10 members) | — | — |
| Invitation | — | — | Manager staff | Not seeded |
| StaffProfile | ✓ inline in staff-mock-service | ✓ `seed.ts` (10 profiles) | Manager staff, staff page | — |
| Venue | ✓ `venue/mock-data.ts` | ✓ `seed.ts` | Manager dashboard, settings | — |
| Zone | ✓ `venue/mock-data.ts` (4 zones) | ✓ `seed.ts` (4 zones) | Manager zones, floor-map | — |
| VenueTable | ✓ `venue/mock-data.ts` (23 tables) | ✓ `seed.ts` (23 tables) | Manager tables, floor-map, guest QR | — |
| StaffShift | ✓ inline in staff-mock-service | ✓ `seed.ts` (27 shifts) | Staff schedule | — |
| VenueRolePermissions | — | — | Manager settings | Not seeded |

### Phase 3: Menu, Inventory, Packages

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| MenuCategory | ✓ `menu/mock-data.ts` (8 cats) | ✓ `seed.ts` (8 cats) | Manager menu, guest menu | — |
| MenuItem | ✓ `menu/mock-data.ts` (31 items) | ✓ `seed.ts` (31 items) | Manager menu, guest menu | — |
| StockMovement | ✓ `menu/mock-data.ts` (5 rows) | ✓ `seed.ts` (5 rows + 31 init in staging) | Manager inventory | Demo: only 5, Live: sales not tracked |
| SoldOutEvent | — | — | Manager inventory | Not seeded anywhere |
| BottlePackage | ✓ `menu/mock-data.ts` (7 pkgs) | ✓ `seed.ts` (7 pkgs) | Guest menu, manager menu | — |
| PackageComponent | ✓ (via packages) | ✓ (via packages) | — | — |
| HappyHourRule | ✓ `menu/mock-data.ts` (3 rules) | ✓ `seed.ts` (3 rules) | Manager happy-hour | — |
| EightySixEntry | — | ✓ `seed-staging.ts` (sparse) | Manager inventory | Demo: nothing; Live: very sparse |

### Phase 4: Orders, Fees, Tab Ledger

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| Order | ✓ inline in ordering/mock-service | ✓ seed-staging + seed-live-history | Staff orders, manager orders, guest orders | Demo: only 39 orders; Live: history ok |
| OrderItem | ✓ inline | ✓ (via orders) | — | — |
| FeeLine | ✓ inline | ✓ (via orders) | — | — |
| AdjustmentReason | ✓ `sessions/tab-mock-data.ts` | — | Manager orders → adjustments | **Live: not seeded** |
| TabAdjustment | ✓ inline in sessions mock-service | — | Manager orders → adjustments | **Live: not seeded** |
| AuditEntry | — | — | Manager audit | **Not seeded anywhere** |
| ShiftCashout | — | — | Manager cashout | **Not seeded anywhere** |
| OrderRemake | ✓ inline in ordering mock-service | — | Manager orders | **Live: not seeded** |
| WalkoutRecord | ✓ inline in ordering mock-service | — | Manager orders | **Live: not seeded** |

### Phase 5: Guest Sessions, Help, Realtime

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| GuestSession | ✓ inline in ordering mock-service | ✓ seed-staging + seed-live-history | Guest cart, manager orders, staff orders | — |
| SessionNote | — | — | — | Not seeded anywhere |
| HelpRequest | ✓ inline in ordering mock-service | ✓ seed-staging + seed-live-history | Guest help, staff help | — |
| DomainEvent | — | — | — | Not seeded (write-only at runtime) |
| Broadcast | — | — | Manager chat, staff chat | Not seeded |
| VenueFloorState | — | — | Manager pulse | Not seeded (runtime singleton) |
| ActiveShowLock | — | — | Manager pulse | Not seeded (runtime singleton) |
| ChatMessage | — | — | Manager chat, staff chat | Not seeded |
| AttentionItem | ✓ inline in pulse-mock-service | — | Manager pulse | **Live: not seeded** |
| AttentionAcknowledgment | — | — | Manager pulse | Not seeded |

### Phase 6: Reservations, Events, Promotions

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| Reservation | ✓ hospitality/reservation-mock-data | ✓ seed-staging + seed-live-history | Manager reservations, staff door | — |
| VenueEvent | ✓ hospitality/events-mock-data | ✓ seed-staging + seed-live-history | Manager events, staff events | — |
| EventGuest | ✓ inline in events-mock-service | ✓ seed-staging + seed-live-history | Manager events | — |
| EventTalent | ✓ hospitality/event-talent-mock-data | — | Manager events | **Live: not seeded** |
| BlackoutDate | ✓ hospitality/blackout-dates-mock-data | — | Manager reservations | **Live: not seeded** |
| Promotion | ✓ hospitality/promotions-mock-data | ✓ seed-staging + seed-live-history | Manager promotions | — |
| EventCost | — | ✓ `seed-staging.ts` | Manager events | Demo: nothing |
| EventRunSheet | — | — | Manager events | Not seeded anywhere |

### Phase 7: Platform Admin, Analytics, Reports, CRM

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| Lead | ✓ platform/admin-mock-data | — | Admin leads | **Live: not seeded** |
| LeadActivity | ✓ inline | — | Admin leads | **Live: not seeded** |
| PlanConfig | ✓ platform/admin-mock-data | ✓ `seed.ts` (via DEFAULT_PLAN_CONFIGS) | Admin plans | Admin plans seeded by app, not seed script |
| TelemetryLink | — | — | Admin settings | Not seeded |
| AdminAction | — | — | Admin venues | Not seeded (append-only at runtime) |
| NightlyRollup | ✓ analytics generator | ✓ seed-live-history (real engine) | Manager analytics, reports | — |
| SavedReport | — | ✓ seed-live-history (2 reports) | Manager reports | Demo: nothing |
| ReportRun | — | ✓ seed-live-history | Manager reports | Demo: nothing |
| GuestProfile | ✓ inline in guests/mock-service | ✓ seed-staging (15 per tenant) | Manager guests | Demo: inline but sparse |
| GuestLink | — | ✓ seed-staging (via seed) | Manager guests | Demo: nothing |
| GuestReferral | — | — | Manager guests | Not seeded anywhere |
| BarTab | — | — | — | Not seeded anywhere |
| VipTierBenefit | — | — | — | Not seeded anywhere |

### Phase 8: Door, Safety, Workforce, Supply Chain

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| Admission | ✓ `door/mock-data.ts` (8 rows) | ✓ seed-staging | Staff door | — |
| OccupancyEvent | ✓ `door/mock-data.ts` (5 rows) | ✓ seed-staging | Manager pulse | — |
| WaitlistEntry | ✓ `door/mock-data.ts` (6 rows) | ✓ seed-staging | Staff door | — |
| CoatCheckTicket | ✓ `door/mock-data.ts` (4 rows) | ✓ seed-staging | Staff door | — |
| DoorRefusal | — | — | Staff door | **Not seeded anywhere** |
| CoatCheckClaim | — | — | — | Not seeded anywhere |
| Incident | ✓ `safety/mock-data.ts` | ✓ seed-staging (sparse) | Manager incidents, staff incidents | — |
| IncidentNote | ✓ inline in safety/mock-service | ✓ seed-staging (sparse) | Manager incidents | — |
| IncidentActionItem | — | — | Manager incidents | **Not seeded anywhere** |
| IncidentTemplate | ✓ `safety/incident-templates-mock-data.ts` | — | Manager incidents | **Live: not seeded** |
| Certification | ✓ workforce/certification-mock-data | — | Manager staff (certifications tab) | **Live: not seeded** |
| ShiftTemplate | — | ✓ seed-staging | Staff schedule, manager staff | Demo: nothing |
| Shift | — | ✓ seed-staging | Staff schedule, manager staff | Demo: nothing |
| TimeEntry | — | ✓ seed-staging | Staff schedule, manager staff/tips | Demo: nothing |
| TimeOffRequest | — | — | Staff schedule | Not seeded |
| ShiftSwapRequest | — | — | Staff schedule | Not seeded |
| TipPoolRule | — | ✓ seed-staging | Manager tips | Demo: nothing |
| TipDistribution | — | ✓ seed-staging | Manager tips, staff tips | Demo: nothing |
| CommissionRule | — | ✓ seed-staging | Manager commission | Demo: nothing |
| CommissionStatement | — | ✓ seed-staging | Manager commission, staff commission | Demo: nothing |
| StaffTableAssignment | — | — | Manager staff | Not seeded |
| ShiftHandoff | — | — | Manager staff | Not seeded |
| Supplier | — | ✓ seed-staging | Manager purchasing | Demo: nothing |
| SupplierItem | — | ✓ seed-staging | Manager purchasing | Demo: nothing |
| PurchaseOrder | — | ✓ seed-staging (2 per supplier) | Manager purchasing | Demo: nothing |
| Stocktake | — | ✓ seed-staging (3 per tenant) | Manager inventory | Demo: nothing |
| ProfitTarget | — | ✓ seed-staging | Manager inventory | Demo: nothing |
| ChecklistTemplate | ✓ `venue/checklist-mock-data.ts` | — | Manager onboarding | **Live: not seeded** |
| ChecklistRun | — | — | Manager onboarding | Not seeded anywhere |

### Phase 9: Automation, Notifications

| Model/Feature | Demo seeded | Live seeded | Proving page | Gap |
|---|---|---|---|---|
| AutomationRule | ✓ inline in automation/mock-service | — | Manager automations | **Live: not seeded** |
| AutomationExecution | — | — | Manager automations | Not seeded |
| NotificationLog | — | — | Staff notifications, admin | **NO MIGRATION. Model has no table.** |
| PushSubscription | — | — | Staff notifications | Not seeded |
| NotificationPreference | — | — | Staff notifications | Not seeded |
| UserQuietHours | — | — | Staff notifications | Not seeded |

## Feature → service selector mapping

| # | Selector | Demo | Live | Gap |
|---|----------|------|------|-----|
| 1 | analytics/analytics-service | ✓ | ✓ | — |
| 2 | analytics/report-service | ✓ | ✓ | — |
| 3 | automation/services | ✓ inline | ✓ | Live: no automation rules seeded |
| 4 | door/services | ✓ `door/mock-data.ts` | ✓ | — |
| 5 | door/waitlist-service | ✓ | ✓ | — |
| 6 | guests/services | ✓ inline | ✓ | — |
| 7 | hospitality/events-service | ✓ `events-mock-data.ts` | ✓ | Live: event talent not seeded |
| 8 | hospitality/promotions-service | ✓ `promotions-mock-data.ts` | ✓ | — |
| 9 | hospitality/reservation-service | ✓ `reservation-mock-data.ts` | ✓ | — |
| 10 | menu/services | ✓ `menu/mock-data.ts` | ✓ `seed.ts` | — |
| 11 | ordering/services | ✓ `ordering/mock-data.ts` | ✓ | Live: tab ledger not seeded |
| 12 | platform/admin-service | ✓ `admin-mock-data.ts` | ✓ | Live: leads not seeded |
| 13 | platform/audit-service | ✓ inline | ✓ | **Live: no audit entries seeded** |
| 14 | platform/auth-service | ✓ `auth-mock-data.ts` | ✓ `seed.ts` | — |
| 15 | platform/billing-service | ✓ inline | ✓ | — |
| 16 | platform/cashout-service | ✓ inline | ✓ | **Live: no cashouts seeded** |
| 17 | platform/permission-service | ✓ inline | ✓ | — |
| 18 | platform/purchasing-service | ✓ inline | ✓ | — |
| 19 | realtime/pulse-service | ✓ inline in pulse-mock-service | ✓ | **Live: no attention items seeded** |
| 20 | realtime/show-queue-service | ✓ inline | ✓ | — |
| 21 | safety/services | ✓ `safety/mock-data.ts` | ✓ | Live: incident templates not seeded |
| 22 | sessions/services | ✓ `sessions/mock-data.ts` | ✓ | Live: tab adjustments not seeded |
| 23 | venue/services | ✓ `venue/mock-data.ts` | ✓ `seed.ts` | — |
| 24 | venue/checklist-service | ✓ `checklist-mock-data.ts` | ✓ | **Live: checklist templates not seeded** |
| 25 | workforce/certification-service | ✓ `certification-mock-data.ts` | ✓ | Live: certifications not seeded |
| 26 | workforce/commission-service | ✓ inline | ✓ | Demo: sparse |
| 27 | workforce/staff-service | ✓ `staff-mock-data.ts` | ✓ | — |
| 28 | workforce/time-service | ✓ inline | ✓ | Demo: sparse |
| 29 | workforce/tips-service | ✓ inline | ✓ | Demo: sparse |

## Pages exercised by current seed data

### Manager (38 pages)

| Page | Populated? | Notes |
|---|---|---|
| `/manager` (dashboard) | ✓ | Venue stats, zones, tonight's activity |
| `/manager/analytics` | ✓ | Charts from nightly rollups |
| `/manager/automations` | Demo: ✓ inline, Live: — | No live automation rules |
| `/manager/audit` | — | **No audit entries in either build** |
| `/manager/cashout` | — | **No cashouts in either build** |
| `/manager/chat` | — | **No chat messages in either build** |
| `/manager/commission` | partial | Demo sparse, Live: seed-staging |
| `/manager/events` | ✓ | Events + event guests |
| `/manager/floor-map` | ✓ | Zones + tables with map positions |
| `/manager/guests` | partial | Demo: inline, Live: seed-staging profiles |
| `/manager/happy-hour` | ✓ | Happy hour rules |
| `/manager/incidents` | partial | Demo: 3 incidents, Live: sparse |
| `/manager/inventory` | partial | Demo: stock movements but no stocktakes |
| `/manager/menu` | ✓ | Full menu catalog |
| `/manager/onboarding` | Demo: ✓ checklist mock, Live: — | No live checklist |
| `/manager/orders` | ✓ | Orders from inline seed |
| `/manager/promotions` | ✓ | Promotions seeded |
| `/manager/pulse` | Demo: ✓ attention items, Live: — | No live attention items |
| `/manager/purchasing` | Demo: —, Live: partial | No demo purchasing data |
| `/manager/qr` | ✓ | Tables with QR slugs |
| `/manager/reports` | Demo: —, Live: 2 reports | No demo reports |
| `/manager/reservations` | ✓ | Reservations seeded |
| `/manager/settings` | ✓ | Venue config |
| `/manager/staff` | partial | Profiles but no certifications/shifts in demo |
| `/manager/subscription` | partial | Plan configs, no billing history in demo |
| `/manager/tables` | ✓ | Full table grid |
| `/manager/tips` | Demo: —, Live: partial | No demo tip distributions |
| `/manager/zones` | ✓ | 4 zones |

### Staff (10 pages)

| Page | Populated? | Notes |
|---|---|---|
| `/staff` (home) | ✓ | Orders, help requests |
| `/staff/approvals` | partial | Demo: simulated, Live: sessions |
| `/staff/chat` | — | **No chat messages** |
| `/staff/door` | ✓ | Admissions, waitlist, coat check |
| `/staff/events` | ✓ | Events list |
| `/staff/help` | ✓ | Help requests |
| `/staff/incidents` | partial | Demo: 3 incidents |
| `/staff/notifications` | — | No notification data |
| `/staff/orders` | ✓ | Order queue |
| `/staff/reservations` | ✓ | Reservations |
| `/staff/schedule` | Demo: —, Live: shifts | No demo shifts |
| `/staff/tips` | Demo: —, Live: partial | Tip distributions |

### Guest (6 pages)

| Page | Populated? | Notes |
|---|---|---|
| `/guest/cart` | ✓ | Orders flow |
| `/guest/gift` | ✓ | Gift flow |
| `/guest/help` | ✓ | Help request flow |
| `/guest/menu` | ✓ | Full menu + packages |
| `/guest/orders` | ✓ | Order history |
| `/guest/receipt` | ✓ | Receipt view |
| `/guest/waiting` | ✓ | Pending approval flow |

### Admin (7 pages)

| Page | Populated? | Notes |
|---|---|---|
| `/admin` | partial | Platform dashboard, telemetry links empty |
| `/admin/leads` | Demo: ✓, Live: — | No live leads |
| `/admin/onboarding` | ✓ | Onboarding flow |
| `/admin/plans` | partial | Plan configs seeded by app startup |
| `/admin/settings` | — | Telemetry links empty |
| `/admin/venues` | ✓ | Venue list |
| `/admin/venues/[id]` | ✓ | Single venue view |

### Public (4 pages)

| Page | Populated? | Notes |
|---|---|---|
| `/` (landing) | — | Marketing page, no seed data required |
| `/demo` | ✓ | Demo tour |
| `/lead` | ✓ | Lead capture form |
| `/pricing` | partial | Plan configs |

## Summary: models with zero live seed data (19)

These need to be seeded for Phase 8 production readiness:

1. **NotificationLog** — **BLOCKER: no migration exists**
2. **AuditEntry** — no seed rows
3. **ShiftCashout** — no seed rows
4. **BarTab** — no seed rows
5. **VipTierBenefit** — no seed rows
6. **SessionNote** — no seed rows
7. **WalkoutRecord** — no live rows (demo has inline)
8. **OrderRemake** — no live rows (demo has inline)
9. **DoorRefusal** — no seed rows
10. **CoatCheckClaim** — no seed rows
11. **IncidentActionItem** — no seed rows
12. **GuestReferral** — no seed rows
13. **ChatMessage** — no seed rows
14. **Broadcast** — no seed rows
15. **DomainEvent** — no seed rows (runtime only, acceptable)
16. **AutomationRule** — no live rows (demo has inline)
17. **AutomationExecution** — no seed rows
18. **ChecklistTemplate** — no live rows (demo has mock)
19. **ChecklistRun** — no seed rows
20. **NotificationPreference** — no seed rows
21. **PushSubscription** — no seed rows
22. **UserQuietHours** — no seed rows
23. **StaffTableAssignment** — no seed rows
24. **ShiftHandoff** — no seed rows
25. **EventRunSheet** — no seed rows

Note: `VenueFloorState` and `ActiveShowLock` are runtime singletons — acceptable to leave unseeded.
`DomainEvent` is append-only at runtime — acceptable to leave unseeded.
`Invitation` is ephemeral (expires) — low priority.

## Summary: models missing mock-data.ts extraction

These domains have seed data inline in `*-mock-service.ts` that should be extracted to `*-mock-data.ts` per §3:

| Domain | Inline data to extract |
|--------|----------------------|
| automation | `mockRules` in `automation/mock-service.ts` |
| guests | Guest profiles, links in `guests/mock-service.ts` |
| realtime | Attention items, chat messages, broadcasts in `pulse-mock-service.ts` |
| analytics | Nothing to extract — already has `analytics-mock-data.ts` |

## Verdict

The seed corpus is functional but inconsistent. The three seed scripts tell different stories with different data. 19 of 98 models have zero live seed data. Demo and live diverge significantly — the same venue name appears in `seed.ts` but the staging script uses entirely different venues. The overhaul goal addresses these gaps.
