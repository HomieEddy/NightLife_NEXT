# 05 — Orders & Fees · PLAN (CORE)

**Status: complete.**

Goal: the order lifecycle server-side — pricing engine, one transaction for
money + inventory, the state machine, claims and gifts. The highest-risk plan;
tests are written **before** implementation, per AGENTS.md §7.2/§9.4.

Preconditions: plan 04 (needs transactional `recordSale`).

## Reasoning

This is where a silent bug costs real money (INV-O2) or sells bottles that don't
exist (INV-O4). Everything before this plan exists to make it small: identities
(02), tables (03) and the ledger (04) are already proven, so this PR is *only* the
pricing engine and the transaction.

## Design choices

- **Schema**: `Order` (status enum, cents fields, claim fields, gift fields,
  snapshots per DDD §4, `sessionId` FK nullable until plan 06 backfills),
  `OrderItem` (+ modifiers as JSONB snapshot), `FeeLine` (fee snapshot per
  INV-O2). Indexes: `(venueId, placedAt)`, `(venueId, status)`, `(sessionId)`.
- **Pricing engine** `src/server/pricing.ts` — pure function, the heart of R3:
  input (items+modifiers, fee config, happy-hour rules, tip) → cents breakdown.
  Ports `fees.ts` + finally applies happy hour at order time (happy-hour TODO):
  active rule (day/time window, category match) discounts qualifying lines before
  fees. Exhaustively unit-tested first (see Testing).
- **The order transaction** (INV-O4): validate session/table → price via engine →
  insert order+items+feeLines → `recordSale` with row locks → emit `OrderPlaced`.
  Any failure rolls back everything. Client sends intents only (AD-5): server
  refuses client-supplied prices.
- **State machine server-side** (INV-O1): `advanceOrder` validates the transition;
  `cancelOrder` only from non-terminal; both emit `OrderStatusChanged`.
- **Claims** (INV-O3): `UPDATE … WHERE claimedByStaffId IS NULL` — the atomic
  compare-and-set the mock faked; claimant identity from session, not payload.
- **Gifts**: `sendGift` = same transaction path with quantity-1 line + immutable
  gift target (INV-O5); price cap stays a UI concern.
- **Last call enforcement moves server-side**: `submitOrder` rejects while the
  venue's last-call flag is set (currently only the button disables — a guest
  with a stale page could still order; real gap closed here). Flag itself still
  mock until plan 07; read through an interface so 07 swaps it invisibly.

## Implementation strategy

1. Write the pricing unit suite against the not-yet-written engine (red).
2. Implement `pricing.ts` until green.
3. Schema + migration + seed (mock orders → cents, snapshots intact).
4. `POST /api/orders` transaction; then swaps: `submitOrder` → `listOrders`/
   `getOrder`/`listGuestOrders`/`listOrdersBySession` → `advanceOrder`/
   `cancelOrder` → `claimOrder`/`releaseOrder` → `sendGift`.
5. Update `cart-contents` to render server-returned fee lines (it already displays
   `feeBreakdown`; it stops computing its own — the Stripe-step TODO stays for
   Phase 3).
6. Rename to `ordersService`; delete consumed TODOs (orders-service header,
   happy-hour pricing, package-card line-type note if package lines get a proper
   `packageId` on OrderItem — include it, it's one column).

## Testing

- Unit (before code): pricing engine — multi-fee stacks (flat+percentage, 3-decimal
  TVQ), happy-hour windows incl. midnight-crossing (22:00–02:00), package lines,
  modifier deltas, tip rounding; property: Σ parts === total, always, in cents.
- Integration: the transaction — success path writes order+items+fees+movements
  atomically; inventory failure rolls back the order; concurrent claims: exactly
  one winner; state-machine rejection matrix; last-call rejection; tenant
  isolation; gift billing vs delivery split.
- E2E: guest scan→order→staff claim→deliver→receipt matches server totals (the
  AGENTS.md §7 flagship flow, now against real DB).

## Review checklist

- Can any request influence a stored price other than via item ids + tip pct?
- Does every write path emit its domain event (needed by plan 07)?
- Are historical orders immune to fee/menu edits (snapshot test)?
- Float leaks: grep new code for `* 100` / `.toFixed` outside the UI boundary.

## Exit criteria

Two-device demo: guest orders on one, staff claims/advances on the other (poll
latency acceptable until 07); pricing suite ≥ every fee scenario in the demo seed;
`ordersService` real; receipt totals byte-identical to server response.
