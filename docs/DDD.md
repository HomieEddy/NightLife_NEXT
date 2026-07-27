# DDD — Domain Model

Status: living document · The domain language below is spoken by
`src/lib/types.ts` and materialized in `prisma/schema.prisma`; this document
organizes it into bounded contexts, aggregates and invariants so the schema and
tests have one authority. Where the two drift, the schema wins and this file
gets fixed (AGENTS.md §9.9).

## 1. Bounded contexts

```
+------------------------------ VENUE (tenant-scoped) -----------------------------+
|                                                                                  |
|  Venue Config      Catalog, Cost &     Ordering (CORE)       Floor Coordination   |
|  venue, zones,     Inventory           orders, sessions,     broadcasts, last     |
|  tables, fees,     categories, items,  help requests,        call, claims, show   |
|  floor map, SLA,   packages, movements,gifts, fee lines,     lock, 86 events      |
|  capacity, targets happy hour,         tab adjustments,                           |
|                    suppliers, POs,     minimum spend,        Door & Admission     |
|  Analytics &       stocktakes, waste   transfers, cash-out   occupancy,           |
|  Profitability                                               admissions, waitlist,|
|  rollups, reports, Workforce           Hospitality Calendar  coat check, ID checks|
|  margin, P&L       staff, shift        reservations, events,                      |
|                    templates &         guestlists,           Safety & Compliance  |
|  Accountability    instances, time     promotions            incidents, refusals, |
|  audit trail       entries, tips,                            responsible service  |
|                    commissions, chat   Guest Identity                             |
|                                        profiles, VIP, bans, consent               |
+----------------------------------------------------------------------------------+
+------------------------------ PLATFORM (cross-tenant) ---------------------------+
|  Identity & Access (users, roles, invites, guest table tokens)                    |
|  Sales & Provisioning (leads, activity)   Tenancy & Billing (tenants, Stripe)     |
+----------------------------------------------------------------------------------+
```

Contexts added by plans 16-19: **Door & Admission** and **Safety & Compliance**
(plan 17), **Guest Identity** (plan 17), **Accountability** (plan 16), and the
cost half of **Catalog, Cost & Inventory** (plan 19). Workforce grows from a
roster into time, tips and commissions (plan 18). Multi-venue grouping is
deliberately absent - see the roadmap parking lot.

**Ordering is the core domain** — it's where money, inventory and guest experience
meet, and where a silent bug costs real money. It gets the strictest invariants and
tests-first treatment. Platform is a separate context with its own (unscoped)
persistence path and must never be reachable from venue code paths.

## 2. Aggregates & invariants

An aggregate is the transaction boundary: everything inside it changes together or
not at all.

### Ordering context

**Order** (root) — `OrderItem[]`, `FeeLine[]`, claim, gift fields.
- INV-O1: `status` transitions only along pending → accepted → preparing → ready →
  delivered; `cancelled` reachable from any non-terminal state. No skips backward.
- INV-O2 (money): `subtotalCents = Σ(baseUnitCents × lineQty + Σ(addOnUnitCents × addOnQty))`;
  `totalCents = subtotalCents + Σ feeLineCents + tipCents` — exactly, in cents.
  Fee lines snapshot the venue's fee config *at placement time* (fee edits never
  rewrite history).
- INV-O3: at most one claimant (`claimedByStaffId`); claiming an already-claimed
  order fails, it does not overwrite.
- INV-O4: order placement and inventory draw-down commit in **one transaction**
  with row locks on base, package-component and washer inventory items.
- INV-O5: add-on quantity is independent of line quantity; stored modifier
  snapshots preserve authoritative kind, names, price and selected quantity.
- INV-O6: a gift order bills the sender's table/session and carries an immutable
  delivery target (`giftToTableId`).

**GuestSession** (root) — the table's tab for the night.
- INV-S1: pending → approved | denied; approved → closure-requested → closed.
  Orders attach only to approved sessions.
- INV-S2: closure-requested requires zero in-flight orders (server-checked; the
  guests-service TODO).
- INV-S3: sessions are keyed to a signed table token; token revocation
  (`tokenVersion` bump) orphans nothing — it only blocks *new* joins.
- INV-S4: approval/auto-approval locks and occupies the table; external settlement
  records method/time and releases it to reserved/open in the same event transaction.

**HelpRequest** (root) — open → acknowledged → resolved; timestamps drive Pulse SLA.

### Catalog & Inventory context

**MenuItem** (root) — price, availability, running inventory.
- INV-I1 (ledger): `inventory === Σ StockMovement.delta` for the item, always.
  Movements are **append-only**; corrections are new adjustment rows, never edits.
- INV-I2: transition to 0 inventory or manual 86 (`isAvailable=false`) emits a
  `SoldOut` event; recovery (restock / re-enable) does not retro-delete events.
- INV-I3: an item referenced by an active package cannot be deleted (inventory-page
  TODO) — deactivate instead.

**BottlePackage** (root) — components reference items; pricing/availability quotes
are *derived*, never stored. **HappyHourRule** (root) — applies at order pricing
time inside the order transaction (happy-hour TODO; wired in plan 05).

### Venue Config context

**Venue** (root) — identity, `ServiceFee[]` (ordered), floor-map canvas, SLA
thresholds, last-call auto-flag, tip presets (`tipPresets`, `defaultTipPct`),
night-window hours (`nightStartHour`/`nightEndHour`, venue timezone), and
`publicSlug` for the embeddable public reservation page (plan 13). **Zone**,
**VenueTable** (roots) — table carries status + map position + `tokenVersion`.
- INV-V1: deleting a zone with tables is rejected (existing service behavior).
- INV-V2: table status is the single source for floor map, guest QR flow and
  reservation seating.

### Floor Coordination context

**Broadcast** — immutable, TTL governs display. **LastCall** — venue-scoped
singleton flag + startedAt. **ActiveShow** — venue-scoped single row;
- INV-F1: at most one active show per venue, enforced with a DB lock
  (`SELECT … FOR UPDATE`), not application memory.
Attention items (Pulse feed) are **derived, never stored** — `computeAttentionItems`
stays a pure function fed by queries.

### Workforce context

**StaffMember** (read model over User + venue Member + StaffProfile), **StaffShift**,
**ChatMessage** (immutable, channel-scoped).

Floor roles are manager / host / bartender / runner / security / promoter; a
single **capability matrix** (`role-capabilities.ts`, plans 14–15) is the one
authority for what each role may do (order actions, session approvals,
help-request scope, nav) — consumed by the staff shell and, at graduation,
enforced in route handlers. Runners fulfill (prepare/ready/deliver) but never
accept orders or approve sessions; security sees only security-type help,
their shifts and the security chat channel; promoters are read-only outside
their own reservation book.

### Hospitality Calendar context

**Reservation** (root) — requested → confirmed → seated → completed | cancelled;
seating flips the table to reserved/occupied. Carries `channel` attribution
(embed/direct/walk-in/manager, plus promoter — plan 14), optional
`promoterId` (stamped onto the `GuestSession` at seat time so promoter
revenue attribution flows reservation → session → orders; promoters CRUD
only their own reservations and never confirm — confirmation stays a venue
action), optional guest contact (`guestEmail`,
`guestPhone`) and a 6-digit `reservationPin` (plan 13): a table with an active
confirmed reservation is QR-gated behind that PIN, so a random scan can't
hijack it. Public embed-page creation writes reservations only — never table
status directly.
**VenueEvent** (root) + `EventGuest[]` guestlist. **Promotion** (root) —
`redemptionCount` increments only inside an order transaction that applied it.

### Accountability context (plan 16)

**TabAdjustment** (append-only) - void / comp / discount against a session,
order or line, with a reason code and an author.
- INV-T1: session net = gross - Σ adjustments, always; `SessionBalance` is
  **derived, never stored**.
- INV-T2: a **void** returns stock (writes a `StockMovement`) in the same
  transaction; a **comp** and a **discount** do not. INV-I1 must hold at every
  instant.
- INV-T3: an adjustment never exceeds the remaining un-adjusted amount of its
  target - no over-comping.
- INV-T4: adjustments are never updated or deleted; a correction is a reversal
  row referencing the original.

**AuditEntry** (append-only, venue-scoped) - every action whose `ACTION_META`
carries `sensitive: true`, plus door overrides, time edits, tip closes and
commission approvals.
- INV-T5: the audit row is written in the **same transaction** as the effect it
  records - never best-effort after the fact.

**ShiftCashout** - expected-by-settlement-method vs. counted, per business date.
- INV-T6: business date derives from the venue's `nightStartHour`/`nightEndHour`,
  never from the calendar day.

### Door & Admission context (plan 17)

**Admission** (append-only) + **OccupancyEvent** (append-only).
- INV-D1: current occupancy = Σ `OccupancyEvent.delta` for the business date; it
  is **never inferred from table state**.
- INV-D2: occupancy never goes negative; a re-entry reuses its original
  admission and does not double-count the cover.
- INV-D3: a `banned` `GuestProfile` cannot be admitted without the
  `door:admit-banned-override` capability, and the override always writes an
  `AuditEntry`.

**WaitlistEntry** - waiting -> notified -> seated | left | expired; position is
**derived** from `joinedAt` within `waiting`, never a stored mutable integer.

**Incident** (root) + append-only `IncidentNote[]`.
- INV-D4: the narrative is immutable after submit; follow-ups are notes.
- INV-D5: a refusal of entry is an `Incident` of type `refused-entry` - there is
  no second refusal table.

### Guest Identity context (plan 17)

**GuestProfile** (root) - created **only** where a guest gave identity
(reservation, guestlist, door ID check, host tag); anonymous QR sessions carry no
profile (PRD R13). `GuestLink` joins profiles to sessions/reservations/event
guests/admissions.
- INV-G1: `visitCount` and `lifetimeNetCents` are rollups recomputed from
  sessions - never hand-edited (same rule as INV-P1).
- INV-G2: ID-check fields record *that* a check occurred (`dobVerified`,
  `byStaffId`, `at`) - never a document number or image.
- INV-G3: marketing consent is per-channel with a capture timestamp and source.

### Workforce context additions (plan 18)

**ShiftTemplate** (recurring) and **Shift** (dated instance) are different
objects; generating a week from templates is an explicit manager action.
**TimeEntry** (append-only, supersede-only), **TipDistribution** (append-only),
**CommissionStatement** (append-only).
- INV-W1: at most one open `TimeEntry` per staff member (enforced by a partial
  unique index, not by a handler).
- INV-W2: Σ `TipDistribution.lines.shareCents` === `poolCents` exactly;
  remainder cents by largest-remainder.
- INV-W3: `TimeEntry` rows are never mutated - an edit is a superseding row with
  an author and a reason.
- INV-W4: published shifts are cancelled, never deleted.
- INV-W5: `isOnShift` is **derived** (an open `TimeEntry` exists) in live mode.

### Cost & Supply context (plan 19)

**Supplier**, **SupplierItem**, **PurchaseOrder** (root) + lines,
**Stocktake** (root) + lines. `StockMovementType` widens to
`restock | sale | adjustment | waste | transfer | return`; `adjustment` narrows
to "the count was wrong".
- INV-C1: INV-I1 (`inventory === Σ movements.delta`) holds across every new
  movement type.
- INV-C2: committing a stocktake writes exactly one `adjustment` movement per
  non-zero variance line, carries `stocktakeId`, and can never be re-committed.
- INV-C3: `qtyReceived <= qtyOrdered` unless an over-receipt is explicitly
  acknowledged.
- INV-C4: `avgCostCents` is written **only** by the receipt path (weighted
  average, AD-18) - never editable from the item form.
- INV-C5: a void's stock return (INV-T2) re-enters at the cost it left at, not at
  the current average. This is the one seam where plans 16 and 19 can silently
  disagree; it is tested from both sides.

### Platform context

**Tenant** (root) — plan, status, Stripe refs; INV-P1: `monthlyRevenue`/limits
derive from the subscription, not hand-edited. **Lead** (root) + append-only
`LeadActivity[]`. **User/Membership/Invite** — identity per AD-4.

## 3. Domain events (the realtime vocabulary, AD-6)

Implemented and published today (`DomainEventType` in `src/server/events.ts`):

`OrderPlaced, OrderStatusChanged, OrderClaimed, OrderReleased, GiftSent,
SessionRequested, SessionApproved, SessionDenied, ClosureRequested, SessionClosed,
HelpRequested, HelpStatusChanged, SoldOut, StockRestocked, BroadcastSent,
LastCallStarted, LastCallEnded, ShowStarted, ShowFinished`

Planned but not yet published (add to the union when their producer lands):

`ReservationSeated, GuestCheckedIn, TenantProvisioned, SubscriptionChanged`

Added by plans 16-19 (each with its producer):

- plan 16 - `TabAdjusted, SessionTransferred, SessionsMerged, CashoutClosed`
- plan 17 - `GuestAdmitted, GuestExited, OccupancyChanged, WaitlistChanged,
  IncidentReported, ServiceRefused` (plus `GuestCheckedIn`/`ReservationSeated`,
  whose producers finally land here)
- plan 18 - `ShiftPublished, ClockedIn, ClockedOut, SwapRequested,
  TipsDistributed`
- plan 19 - `PurchaseOrderSubmitted, StockReceived, StocktakeCommitted,
  WasteRecorded, TargetBreached`

Events carry `venueId`, aggregate id, and a minimal payload; they are the *only*
things published on NOTIFY and the only things UIs react to live. Each is also
persisted to the `domain_events` table (audit) in the same transaction as the
NOTIFY.

## 4. Denormalizations — decided per field (AGENTS.md §9.3)

Phase 1 duplicated display fields for UI convenience. Verdicts:

| Field | Verdict | Why |
|---|---|---|
| `Order.tableCode`, `Order.zoneName`, `Order.guestName` | **Keep (snapshot)** | Receipts must show what was true at order time; renames must not rewrite history. |
| `Order.feeBreakdown` | **Keep (snapshot)** | Same — fee config changes are not retroactive (INV-O2). |
| `StockMovement.itemName` | **Keep (snapshot)** | Ledger rows outlive item renames/deletes. |
| `Zone.tableCount` | **Drop → count query** | Pure convenience; already drifts. |
| `HelpRequest.tableCode/zoneName` | **Replace with `tableId` FK** + keep code as snapshot | Pulse needs the FK (pulse.ts matches by code today — a known fragility). |
| `GuestSession.tableCode/zoneName` | Same as HelpRequest | |
| `AttentionItem.*` | **Never stored** | Derived view (§2). |
| `AnalyticsSummary.*` | **Never stored** as-is | Recomputed / rollups (AD-11). |

## 5. Ubiquitous language (deltas only)

- **"86"** = item unavailable regardless of stock; noun and verb; the event feed is
  the *86-board*.
- **"Show"** = a bottle-presentation walk-out; the **show floor** is a venue-wide
  mutex, not a queue.
- **"Session" / "tab"** = one table-party's night; orders attach to it; the
  **receipt** is the session's closing document.
- **"Pulse"** = the derived needs-attention feed; **SLA thresholds** are venue
  config, not global.
- **"Last call"** = venue-wide ordering stop + optional table-closeout nudges.
- **"Void" / "comp" / "discount"** = three distinct events, never synonyms: a
  void didn't happen (stock returns), a comp happened and isn't paid for (stock
  doesn't), a discount happened and is partly paid for.
- **"Minimum"** = a table's or reservation's committed spend; the **shortfall**
  is what's left of it. It is surfaced and warned on, never enforced by blocking
  orders.
- **"The door"** = the admission surface and the people working it;
  **occupancy** is the counted number in the room, distinct from seated covers.
- **"86"** now also distinguishes a manual 86 (`EightySixEntry`) from stock
  reaching zero - both feed the same board.
- **"Pour cost"** = COGS / net revenue; **variance** = counted minus expected at
  a stocktake; **shrinkage** is variance expressed as a rate.
- **"Business date"** = the night a thing belongs to, from the venue's
  `nightStartHour`/`nightEndHour` - never the calendar day. Shifts, cash-outs,
  occupancy, admissions and stocktakes all bucket by it.
- **"Tenant"** (platform) vs **"Venue"** (inside the app): same entity, two
  contexts; platform code says tenant, venue code says venue.

## 6. Schema conventions (feed into every plan)

- ids: `cuid()` text PKs; every tenant table has `venueId` + composite indexes
  starting with it (AD-3).
- money: `*Cents Int` (AD-5); quantities: `Int`; timestamps: `timestamptz`
  `createdAt`/`updatedAt` on every table.
- enums: Prisma enums mirroring the TS unions (`OrderStatus`, `TableStatus`, …).
- soft delete (`deletedAt`) only where history demands it: orders, movements,
  sessions. Hard delete is fine for config rows the UI already guards.
- ledgers (`stock_movements`, `lead_activity`, `chat_messages`, `broadcasts`,
  `sold_out_events`): INSERT-only — no UPDATE/DELETE grants in prod.
