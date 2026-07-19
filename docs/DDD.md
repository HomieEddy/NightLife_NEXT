# DDD — Domain Model

Status: living document · The domain language below is spoken by
`src/lib/types.ts` and materialized in `prisma/schema.prisma`; this document
organizes it into bounded contexts, aggregates and invariants so the schema and
tests have one authority. Where the two drift, the schema wins and this file
gets fixed (AGENTS.md §9.9).

## 1. Bounded contexts

```
┌────────────────────────────── VENUE (tenant-scoped) ─────────────────────────────┐
│                                                                                  │
│  Venue Config      Catalog &         Ordering (CORE)      Floor Coordination     │
│  venue, zones,     Inventory         orders, sessions,    broadcasts, last call, │
│  tables, fees,     categories,       help requests,       claims, show lock,     │
│  floor map, SLA    items, packages,  gifts, fee lines     86 events              │
│                    movements,                                                    │
│                    happy hour        Workforce            Hospitality Calendar   │
│                                      staff, shifts,       reservations, events,  │
│  Analytics & Reporting               chat                 guestlists, promotions │
│  rollups, saved reports                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────── PLATFORM (cross-tenant) ───────────────────────────┐
│  Identity & Access (users, roles, invites, guest table tokens)                   │
│  Sales & Provisioning (leads, activity)   Tenancy & Billing (tenants, Stripe)    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

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

### Hospitality Calendar context

**Reservation** (root) — requested → confirmed → seated → completed | cancelled;
seating flips the table to reserved/occupied. Carries `channel` attribution
(embed/direct/walk-in/manager), optional guest contact (`guestEmail`,
`guestPhone`) and a 6-digit `reservationPin` (plan 13): a table with an active
confirmed reservation is QR-gated behind that PIN, so a random scan can't
hijack it. Public embed-page creation writes reservations only — never table
status directly.
**VenueEvent** (root) + `EventGuest[]` guestlist. **Promotion** (root) —
`redemptionCount` increments only inside an order transaction that applied it.

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
