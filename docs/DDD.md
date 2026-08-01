# DDD — Domain Model

**Status:** Living document. The domain language below is spoken by
`src/lib/types.ts` and materialized in `prisma/schema.prisma`; this document
organizes it into bounded contexts, aggregates and invariants.
**Last updated:** 2026-07-30. Every context and event below exists in
`src/lib/types.ts` and the mock services; the "live" marker on the event lists
records whether it is also published by the live build (`domain_events` +
`NOTIFY`) or still demo-track only, pending ROADMAP Phase 7 graduation.

Where the two drift, the schema wins and this file gets fixed (AGENTS.md §9.9).

---

## 1. Bounded contexts

```
+------------------------------ VENUE (tenant-scoped) -----------------------------+
|                                                                                  |
|  Venue Config           Catalog, Cost &        Ordering (CORE)                   |
|  venue, zones,          Inventory              orders, sessions,                |
|  tables, fees,          categories, items,     help requests, gifts,            |
|  floor map, SLA,        packages, movements,   fee lines, tab adjustments,      |
|  capacity, targets,     happy hour, suppliers, minimum spend, transfers,        |
|  rules engine config    POs, stocktakes,       cash-out, split-bill,            |
|                         waste, recipes,        auto-gratuity, order priority,   |
|  Analytics &            pour cost              SLA tracking, ETA                |
|  Profitability                                                                  |
|  rollups, reports,      Workforce              Hospitality Calendar             |
|  margin, P&L,           staff, shift           reservations, events,            |
|  comparison views,      templates &            guestlists, promotions,          |
|  projections,           instances, time        pin gating, deposit,             |
|  SLA metrics            entries, breaks,       cancellation policy,             |
|                         tips, commissions,     hold timers                       |
|  Accountability         certifications,                                         |
|  audit trail            staffing minimums      Door & Admission                 |
|                         Pre-shift briefings    occupancy, admissions,           |
|  Notifications                                  waitlist, coat check,           |
|  notification log,      Chat & Realtime        ID checks, age verification,     |
|  preferences,           chat messages,         cover price schedule,            |
|  templates              broadcasts, pulse      wristband tracking,              |
|                         attention items        denied-entry recording           |
|  Compliance                                                                     |
|  compliance calendar,   Safety & Incidents     Guest Identity & CRM             |
|  mandatory reports,     incidents, notes,      profiles, VIP tiers,             |
|  certification tracking witness statements,    bans, watchlist, preferences,    |
|                         CCTV references,       celebrations, linked profiles,   |
|                         escalation,            staff notes, photo,              |
|                         ejection workflow,     RFM scoring, referral tracking,  |
|                         evacuation mode        visit history, consent           |
+----------------------------------------------------------------------------------+
+------------------------------ PLATFORM (cross-tenant) ---------------------------+
|  Identity & Access (users, roles, invites, guest table tokens)                    |
|  Sales & Provisioning (leads, activity)   Tenant Billing (SaaS subscriptions,    |
|  Stripe integration — tenant plans only, never guest payments)                    |
+----------------------------------------------------------------------------------+
```

Contexts that cross-cut the venue diagram above:

- **Guest Identity & CRM** — profiles carry preferences, celebrations, linked
  profiles, staff notes, photo, value scoring, referral tracking, and
  spend-by-category: an identity record grown into a relationship hub.
  Demo track; live pending (Phase 7, WS-2).
- **Notifications** — the `NotificationLog` and `NotificationPreferences`
  aggregates, plus the template registry and dispatcher (AD-22). Cross-cuts every
  context: any domain event can trigger a notification. **Live.**
- **Compliance** — certification tracking, compliance calendar, mandatory
  incident reporting, data retention, and the breach register. Cross-cuts
  workforce, incidents, and guest identity. Demo track; retention and the breach
  register land with plan 35.
- **PWA Infrastructure** — `PushSubscription` and the offline queue are technical
  aggregates: they don't model the business domain but are first-class
  architectural concerns. **Live.**
- **Rules Engine** (AD-21) — the `RuleDefinition` aggregate plus the evaluator.
  Cross-cuts ordering (auto-gratuity, SLA), workforce (overtime, breaks),
  venue config (capacity warnings), and inventory (par levels). Partially
  realized: the automation engine implements the scheduled and event-driven
  half; the rest is still inline per feature (see AD-21's status note).

Multi-venue grouping remains deliberately absent (roadmap parking lot).

**Ordering is the core domain** — it's where money, inventory, guest experience,
auto-gratuity, and priority meet. It gets the strictest invariants and
tests-first treatment.

---

## 2. Aggregates & invariants

### Ordering context

**Order** (root) — `OrderItem[]`, `FeeLine[]`, claim, gift fields, priority, SLA.
- INV-O1: `status` transitions only along pending → accepted → preparing → ready →
  delivered; `cancelled` reachable from any non-terminal state. No skips backward.
- INV-O2 (money): `subtotalCents = Σ(baseUnitCents × lineQty + Σ(addOnUnitCents × addOnQty))`;
  `totalCents = subtotalCents + Σ feeLineCents + tipCents + autoGratuityCents` — exactly,
  in cents. Fee lines snapshot the venue's fee config *at placement time*.
- INV-O3: at most one claimant (`claimedByStaffId`); claiming an already-claimed
  order fails.
- INV-O4: order placement and inventory draw-down commit in **one transaction**
  with row locks on base, package-component and washer inventory items.
- INV-O5: pre-order inventory check (`currentStock >= totalQuantity`) runs before
  placement; insufficient stock rejects the order with an error.
- INV-O6: a gift order bills the sender's table/session and carries an immutable
  delivery target (`giftToTableId`).
- **INV-O7 (priority):** `priorityScore` is derived at placement from zone config,
  table minimum spend, session age, and order type — never hand-edited.
- **INV-O8 (SLA):** `slaWarnAt` and `slaCriticalAt` are computed from venue
  `slaThresholds` at placement; warnings and critical flags are derived, never
  stored.
- **INV-O9 (auto-gratuity):** `autoGratuityCents` is computed server-side in the
  settlement transaction from active `AutoGratuityRule` definitions at close time;
  the guest sees it as an explicit line item.
- **INV-O10 (modification):** an order may only be modified (add/remove items,
  change modifiers) while in `pending` status. Once `accepted`, the order is
  immutable — corrections after acceptance are tab adjustments (Plan 16), not
  edits. Modification re-runs INV-O2 (total recomputation) and INV-O5
  (inventory check for added items) in one transaction.

**GuestSession** (root) — the table's tab for the night.
- INV-S1: pending → approved | denied; approved → closure-requested → closed |
  reopened. Orders attach only to approved sessions.
- INV-S2: closure-requested requires zero in-flight orders (server-checked).
- INV-S3: sessions are keyed to a signed table token; token revocation only blocks
  *new* joins.
- INV-S4: approval locks and occupies the table; settlement records method/time
  and releases it.
- **INV-S5 (split-bill):** a session can have N `SplitParticipant` assignments.
  Each order item is assigned to exactly one participant. Σ participant net ===
  session net. Split settlement is sequential, not parallel.
- **INV-S6 (minimum spend):** `minimumSpendCents` is snapshotted at approval from
  the reservation or table default. Progress is derived from order total minus
  adjustments, never stored. Shortfall at close is surfaced, not enforced by
  blocking closure.
- **INV-S7 (transfer chain):** session transfers record a full chain
  (`transferredFromTableId` is the immediate predecessor; the full chain is
  derived by walking predecessor links).
- **INV-S8 (auto-timeout):** pending sessions with no approval action within
  `venue.sessionTimeoutMinutes` are auto-transitioned to `denied` with reason
  `timeout` by an idempotent cron job (AD-9).
- **INV-S9 (reopen window):** a `closed` session may transition to `reopened`
  only within `venue.sessionReopenWindowMinutes` of closure. Reopening
  re-occupies the table (INV-S4) and restores the original minimum-spend
  snapshot (INV-S6). A session closed by cash-out (Plan 16) cannot be reopened
  — the reconciliation is final.

**HelpRequest** (root) — open → acknowledged → resolved; timestamps drive Pulse SLA.

### Catalog & Inventory context

**MenuItem** (root) — price, availability, running inventory.
- INV-I1 (ledger): `inventory === Σ StockMovement.delta` — always. Movements are
  append-only; corrections are new adjustment rows.
- INV-I2: transition to 0 inventory or manual 86 (`isAvailable=false`) emits a
  `SoldOut` event; restock does not retro-delete.
- INV-I3: an item referenced by an active package cannot be deleted.
- **INV-I4 (cost):** `avgCostCents` is written **only** by the receipt path
  (weighted average, AD-18). Never editable from the item form.
- **INV-I5 (waste):** waste movements carry a mandatory `wasteReasonCode`
  (spillage, breakage, spoilage, theft, over-pour). Waste analytics derive
  from this code.
- **INV-I6 (transfer):** inter-zone stock transfers create two movements
  (decrement source zone, increment target zone) in one transaction.
- **INV-I7 (par levels):** `parLevels` are per-day-of-week. Auto-suggested
  reorder quantity = max(par[today] - currentStock, 0).

**BottlePackage** (root) — components reference items; pricing/availability
quotes are *derived*. **Recipe** (parked, see ROADMAP tier 3) — BOM linking a drink to component
pour costs; pour cost = Σ(componentCost × pourQty) / sellPrice.

**HappyHourRule** (root) — applies at order pricing time inside the order
transaction.

### Venue Config context

**Venue** (root) — identity, `ServiceFee[]` (ordered), floor-map canvas, SLA
thresholds, last-call auto-flag, tip presets, night-window hours,
`publicSlug`, `legalDrinkingAge`, `cancellationWindowHours`,
`reservationHoldMinutes`, `sessionTimeoutMinutes`, `reEntryCutoffTime`,
`swapDeadlineHours`, `overtimeThresholdHours`, `breakRequirementMinutes`,
`noShowGraceMinutes`, `lateThresholdMinutes`, `sessionReopenWindowMinutes`,
and `occupancyWarnRatio`.

**Zone**, **VenueTable** (roots) — table carries status + map position +
`tokenVersion` + `requiresVipTier`.
- INV-V1: deleting a zone with tables is rejected.
- INV-V2: table status is the single source for floor map, QR flow and reservation
  seating.
- **INV-V3 (capacity-aware booking):** creating a reservation checks that
  Σ confirmed reservation party sizes for overlapping time windows ≤
  `legalCapacity × capacityBufferRatio`. Warns if within buffer; blocks if exceeded.
- **INV-V4 (cover price schedule):** `CoverPriceRule` definitions are
  time/event/category-scoped. Admission `amountOwedCents` is derived from the
  active rule at admission time, not hand-entered.

### Floor Coordination context

**Broadcast** — immutable, TTL governs display. **LastCall** — venue-scoped
singleton flag + startedAt. **ActiveShow** — venue-scoped single row;
- INV-F1: at most one active show per venue (`SELECT … FOR UPDATE`).
- **INV-F2 (emergency):** `EmergencyEvacuation` event zeroes occupancy in one
  transaction, broadcasts to all channels with distinct severity, and records
  the evacuation in the occupancy ledger. Resuming normal operations requires
  a manager override.

Attention items (Pulse feed) are **derived, never stored** — `computeAttentionItems`
stays a pure function fed by queries.

### Workforce context

**StaffMember** (read model over User + venue Member + StaffProfile).
**ShiftTemplate** (recurring), **Shift** (dated instance), **TimeEntry**
(append-only, supersede-only), **TipDistribution** (append-only),
**CommissionStatement** (append-only), **Certification** (root).

- INV-W1: at most one open `TimeEntry` per staff member (partial unique index).
- INV-W2: Σ `TipDistribution.lines.shareCents` === `poolCents` exactly.
- INV-W3: `TimeEntry` rows are never mutated — edits are superseding rows.
- INV-W4: published shifts are cancelled, never deleted.
- INV-W5: `isOnShift` is **derived** (an open `TimeEntry` exists) in live mode.
- **INV-W6 (overtime):** overtime is derived from `actualMinutes - scheduledMinutes`
  when `actualMinutes > overtimeThreshold`; flagged as an attention item.
- **INV-W7 (late arrival):** late arrival is derived from `clockInTime -
  scheduledStart > lateThreshold`; accumulated across shifts for pattern detection.
- **INV-W8 (no-show):** a shift with no clock-in at `scheduledStart +
  noShowGraceMinutes` is auto-transitioned to `no-show`; manager notified.
- **INV-W9 (certification):** a `Shift` cannot be published for a staff member
  whose required certification is expired at the start time. Certification
  expiry within 30 days generates an attention item.
- **INV-W10 (staffing minimum):** a `Shift` publish action validates that
  Σ scheduled staff per role per zone meets `ZoneCoverageRule.minimum`.
  Warnings for gaps; blocks for safety-critical roles (security).
- **INV-W11 (pre-shift briefing):** a `BriefingNote` is authored by a manager,
  scoped to a business date, and surfaced to all staff with a shift on that date.

### Hospitality Calendar context

**Reservation** (root) — requested → confirmed → seated → completed | cancelled |
no-show. Carries `arrivalTime`, `durationMinutes`, `channel`, `promoterId`,
`guestEmail`, `guestPhone`, `reservationPin`, `depositAmountCents`,
`depositStatus` (unpaid | paid | forfeited | refunded), `holdExpiresAt`.

- INV-R1: no two confirmed reservations for the same table have overlapping
  `[arrivalTime, arrivalTime + durationMinutes]` windows.
- INV-R2: deposit status must be `paid` before transition to `confirmed`.
  All deposit status transitions (paid, forfeited, refunded) are staff-initiated
  manual toggles reflecting external actions — the platform records the status,
  it does not process the payment (PRD §4).
- INV-R3: cancellation within `cancellationWindowHours` of `arrivalTime`
  auto-flags `lateCancellation: true` and transitions deposit to `forfeited`.
- INV-R4: a `holdExpiresAt` in the past triggers auto-cancellation (cron job).
- INV-R5: seating flips table to `occupied`; check-out flips to `open` or
  `reserved` (if another booking exists within turn-time window).

**VenueEvent** (root) + `EventGuest[]` guestlist.
- INV-E1: Σ event guests cannot exceed `event.guestlistCapacity`.
- INV-E2: per-promoter allocation: Σ guests attributed to promoter ≤
  `promoterAllocation.limit`.
- **INV-E3 (event menu/pricing):** an `EventMenuOverride` scopes item
  availability and price overrides to `[event.startTime, event.endTime]`.
  During an active event window, the override price takes precedence over
  the base `MenuItem.priceCents` for ordering (INV-O2 uses the override).
  Items excluded by the override are unavailable for the event's duration.
  Outside the window, the base catalog applies — no manual toggle required.

**Promotion** (root) — `redemptionCount` increments only inside an order
transaction that applied it.

### Accountability context

**TabAdjustment** (append-only), **AuditEntry** (append-only, venue-scoped),
**ShiftCashout**.
- INV-T1: session net = gross - Σ adjustments (derived, never stored).
- INV-T2: void returns stock (writes a `StockMovement`) in the same transaction;
  comp and discount do not.
- INV-T3: adjustment never exceeds remaining un-adjusted amount of its target.
- INV-T4: adjustments never updated or deleted; correction = reversal row.
- INV-T5: audit row written in same transaction as the effect it records.

### Door & Admission context

**Admission** (append-only), **OccupancyEvent** (append-only),
**WaitlistEntry**, **CoatCheckTicket**.
- INV-D1: current occupancy = Σ `OccupancyEvent.delta` for the business date.
  Never inferred from table state.
- INV-D2: occupancy never goes negative.
- INV-D3: a `banned` `GuestProfile` cannot be admitted without
  `door:admit-banned-override` capability; override always audits.
- **INV-D4 (age verification):** admission of a guest whose `dateOfBirth` is
  younger than `venue.legalDrinkingAge` years at `admittedAt` is blocked.
  Blocked admission records type `denied` with reason `underage`.
- **INV-D5 (watchlist):** a `watchlisted` guest admitted shows a warning banner
  at admission and on the session approval screen. Does not block admission.
- **INV-D6 (denied entry):** a denied admission creates an `Admission` record
  with type `denied` and a mandatory `denialReason` (underage, intoxication,
  fake-id, dress-code, banned, capacity, other). Occupancy does not change.
- **INV-D7 (ejection):** ejecting a guest in one transaction: creates ejection
  incident → sets profile status to `banned` → closes open tab → pushes
  "deny re-entry" to door surface → records admission type `ejected` with
  negative occupancy delta.
- **INV-D8 (evacuation):** emergency evacuation creates one `OccupancyEvent`
  with delta = -(current occupancy) and type `emergency-evacuation`. Does not
  delete or edit prior events.

**WaitlistEntry** — waiting → notified → seated | left | expired.
**Incident** (root) + append-only `IncidentNote[]`, `WitnessStatement[]`,
`IncidentActionItem[]`.
- INV-D9: narrative is immutable after submit; follow-ups are notes.
- **INV-D10 (compliance):** an incident with `reportable: true` carries a
  `regulatoryDeadline` and `reportedToAuthorityAt`. Overdue reportable incidents
  appear in the Pulse feed and compliance calendar.
- **INV-D11 (CCTV):** `CctvReference: { cameraId, timestampStart, timestampEnd }`
  links an incident to specific footage.
- **INV-D12 (action items):** an incident can have N `IncidentActionItem`s
  (assignee, description, deadline, status). Created during incident review.

### Guest Identity & CRM context

**GuestProfile** (root), **GuestLink**, **GuestPreference**, **GuestNote**,
**GuestProfileLink**, **GuestReferral**.

- INV-G1: `visitCount` and `lifetimeNetCents` are rollups recomputed from
  closed sessions — never hand-edited.
- INV-G2: ID-check fields record *that* a check occurred — never a document
  number or image.
- INV-G3: marketing consent is per-channel with capture timestamp and source.
- **INV-G4 (preferences):** `GuestPreference` is a sub-aggregate of
  `GuestProfile`. Updated by any staff with guest-profile write access.
- **INV-G5 (celebrations):** `celebrationDates: [{ type, date: "MM-DD" }]`.
  Flagged at every touchpoint when the current date matches.
- **INV-G6 (watchlist):** `watchlisted: boolean` is separate from `status: "banned"`.
  Watchlisted guests are admitted with a warning; banned guests are blocked.
- **INV-G7 (photo):** `photoUrl` is an optional URL to a stored image. Never a
  base64 blob in the DB row.
- **INV-G8 (RFM):** recency (days since last visit), frequency (visits in 90 days),
  and monetary (average spend per visit) scores are derived, never stored.
  Recomputed on session close.
- **INV-G9 (linked profiles):** `GuestProfileLink: { profileA, profileB, relationship }`.
  Bidirectional. Displayed on both profiles. Does not merge spend or visits.
- **INV-G10 (referral):** `GuestReferral: { referrerProfileId, referredProfileId,
  date, status }`. Attributable for referral bonuses.

### Notifications context

**NotificationPreference** (root, per user), **NotificationLog** (append-only),
**PushSubscription** (per user per device).

- INV-N1: a notification is sent to a recipient over a channel **only if**
  the recipient has an active `NotificationPreference` with `enabled: true`
  for that event type and channel.
- INV-N2: `NotificationLog` rows are keyed by `(eventId, recipientId, channel)`.
  Duplicate sends are blocked by unique constraint.
- INV-N3: `PushSubscription.endpoint` is unique per user per device. Token
  rotation creates a new row and marks the old as `expired`.
- INV-N4: quiet hours suppress non-critical notifications. Critical notifications
  (emergency, security alert, incident escalation) bypass quiet hours.

### Compliance context

**Certification** (root, per staff member), **ComplianceItem** (root, per venue),
**DataRetentionPolicy**, **BreachRecord**.

- INV-C1: `Certification` with `expiresAt < now()` blocks shift publish for
  roles that require it.
- INV-C2: `ComplianceItem` with `dueDate < now()` and no `completedAt` generates
  an attention item. Notification at 30, 14, 7, and 1 days before due date.
- INV-C3: `MandatoryReport` is linked to an incident with `reportable: true`.
  Overdue reports escalate through the attention feed.

### Cost & Supply context

**Supplier**, **SupplierItem**, **PurchaseOrder** (root) + lines,
**Stocktake** (root) + lines.
- INV-CS1 through INV-CS5: unchanged from prior DDD version (renamed from
  INV-C* to avoid collision with Compliance context invariants).
- **INV-CS6 (auto-suggested PO):** `suggestedOrderQuantity = max(parLevel[today] -
  currentStock, 0)`, surfaced as an attention item and a one-click "create PO" action.

### Platform context

**Tenant** (root), **Lead** (root) + append-only `LeadActivity[]`,
**User/Membership/Invite**. Stripe integration is tenant SaaS subscription
billing only — no guest or venue payment processing (AD-12).

---

## 3. Domain events (the realtime vocabulary)

### Published by the live build today

`OrderPlaced, OrderStatusChanged, OrderClaimed, OrderReleased, GiftSent,
SessionRequested, SessionApproved, SessionDenied, ClosureRequested, SessionClosed,
HelpRequested, HelpStatusChanged, SoldOut, StockRestocked, BroadcastSent,
LastCallStarted, LastCallEnded, ShowStarted, ShowFinished`

### Tab, door, identity & safety — demo track; live pending (Phase 7, WS-1/WS-2)

`TabAdjusted, SessionTransferred, SessionsMerged, SessionSplit, CashoutClosed,
GuestAdmitted, GuestExited, GuestDenied, OccupancyChanged, OccupancyWarning,
WaitlistChanged, WaitlistNotified, IncidentReported, IncidentEscalated,
ServiceRefused, ReservationSeated, GuestCheckedIn, GuestProfileCreated,
GuestBanned, GuestWatchlisted, NotificationSent, NotificationFailed,
EmergencyEvacuated, CertificationExpiring`

### Workforce, hospitality & operational features — demo track; live pending (Phase 7, WS-3/WS-4/WS-5)

`ShiftPublished, ShiftSwapRequested, ShiftSwapApproved, ClockedIn, ClockedOut,
BreakStarted, BreakEnded, ShiftNoShow, OvertimeWarning, LateArrivalFlagged,
StaffingMinimumViolation, TipsDistributed, CommissionStatementApproved,
CoverPriceChanged, ReservationHoldExpired, DepositForfeited, LateCancellation,
TableMinimumProgress, TabCapWarning, DualSessionDetected, GuestCelebrationToday,
WatchlistWarning, VipArrived, EjectionExecuted, OrderOverdue, OrderPriorityChanged,
OrderEtaUpdated, BriefingPublished, IncidentActionAssigned, WitnessRecorded,
CctvLinked, MandatoryReportDue`

### Automations & intelligence — live

`PourCostTargetBreached, VarianceThresholdExceeded, ParLevelLow,
AutoSuggestedPo, VipTierUpgradeSuggested, DormantVipDetected,
DuplicateReservationDetected, EventAutoEnded, StocktakeVarianceFlagged`

### PWA & push — live

`PushSubscribed, PushUnsubscribed, PushDelivered, PushClicked, PushFailed,
NotificationPreferenceChanged, OfflineActionQueued, OfflineActionSynced,
OfflineActionFailed, SwUpdateAvailable, SwUpdateApplied`

### Compliance & hardening — pending plan 35 (Phase 8)

`ComplianceDeadlineApproaching, ComplianceDeadlineOverdue, DataRetentionExecuted,
DataDeletionCompleted, BreachRecorded, SecurityScanCompleted`

Events carry `venueId`, aggregate id, and a minimal payload. They are the *only*
things published on `NOTIFY` and the only things UIs react to live. Each is
also persisted to `domain_events`. The notification dispatcher (AD-22) reads
domain events and routes them to the appropriate channels per recipient
preferences.

---

## 4. Denormalizations — decided per field

| Field | Verdict | Why |
|---|---|---|
| `Order.tableCode`, `Order.zoneName`, `Order.guestName` | **Keep (snapshot)** | Receipts show what was true at order time. |
| `Order.feeBreakdown` | **Keep (snapshot)** | Fee config changes are not retroactive. |
| `StockMovement.itemName` | **Keep (snapshot)** | Ledger rows outlive item renames/deletes. |
| `Zone.tableCount` | **Drop → count query** | Already drifts; pure convenience. |
| `GuestSession.tableCode/zoneName` | **Keep as snapshot, FK to table** | Pulse needs the FK. |
| `AttentionItem.*` | **Never stored** | Derived view. |
| `AnalyticsSummary.*` | **Never stored as-is** | Recomputed / rollups (AD-11). |
| `GuestProfile.visitCount/lifetimeNetCents` | **Recomputed on session close** | Rollups, never hand-edited. |
| `GuestProfile.rfmScore` | **Never stored** | Derived on read; recomputed on session close. |
| `Order.priorityScore` | **Never stored** | Derived from zone, minimum spend, session age at placement. |
| `SessionBalance` | **Never stored** | Derived from orders + adjustments. |
| `OccupancyEvent.current` | **Never stored per row** | Derived = Σ delta for business date. |

---

## 5. Ubiquitous language (additions)

- **"86"** = item unavailable regardless of stock. **Manual 86** vs **auto-86**
  (stock hit zero) — both feed the 86-board.
- **"Show"** = bottle-presentation walk-out. **Show lock** = venue-wide mutex.
- **"Session" / "tab"** = one table-party's night. **Receipt** = closing document.
- **"Pulse"** = derived needs-attention feed.
- **"Last call"** = venue-wide ordering stop + table-closeout nudges.
- **"Void" / "comp" / "discount"** = three distinct events. Void = stock returns.
  Comp = stock doesn't. Discount = partly paid for.
- **"Minimum"** = committed spend. **Shortfall** = what's left.
- **"The door"** = admission surface. **Occupancy** = counted number in the room,
  distinct from seated covers.
- **"Pour cost"** = COGS / net revenue. **Variance** = counted minus expected.
  **Shrinkage** = variance as a rate.
- **"Business date"** = the night a thing belongs to, from venue `nightStartHour`/
  `nightEndHour` — never the calendar day.

### New terms

- **"Watchlist"** = guest flagged for awareness at admission (doesn't block entry).
  Distinct from **"banned"** (blocks entry).
- **"Ejection"** = one-action workflow: eject → close tab → ban profile → notify door.
- **"Auto-gratuity"** = mandatory service charge on qualifying sessions (party size,
  zone, table minimum trigger). Computed at close, displayed as line item.
- **"Split-bill"** = per-item assignment within a session. **Participant** = one
  payee within a split.
- **"RFM"** = Recency, Frequency, Monetary — guest value scoring. Derived, never stored.
- **"Quiet hours"** = per-user time window where non-critical notifications are
  suppressed. Critical notifications (emergency, security) bypass.
- **"Offline queue"** = localStorage-backed action buffer. Replays on reconnect.
- **"App shell"** = the cached UI chrome that renders before data arrives.
- **"Denied entry"** = admission type for refused guests. Carries mandatory
  `denialReason`.

---

## 6. Schema conventions (feed into every plan)

- ids: `cuid()` text PKs; every tenant table has `venueId` + composite indexes
  starting with it (AD-3).
- money: `*Cents Int` (AD-5); quantities: `Int`; timestamps: `timestamptz`
  `createdAt`/`updatedAt` on every table.
- enums: Prisma enums mirroring TS unions.
- soft delete (`deletedAt`) only where history demands it: orders, movements,
  sessions. Hard delete for config rows the UI guards.
- ledgers: INSERT-only — no UPDATE/DELETE grants in prod.
- `notification_logs`: append-only. `notification_preferences`: mutable.
  `push_subscriptions`: mutable (token rotation creates new, marks old expired).
- `certifications`: mutable with audit on expiry date changes.
- `compliance_items`: mutable. `mandatory_reports`: append-only (corrections are
  new rows).
