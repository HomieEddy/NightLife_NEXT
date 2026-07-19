# 08 — Reservations, Events & Promotions · PLAN

**Status: complete.**

Goal: the hospitality-calendar context — three low-risk CRUD services that follow
the plan-03 template, with two real integration points (table status, order
pricing).

Preconditions: plans 03 (tables), 05 (promotion redemption in pricing).

## Reasoning

These landed late in the prototype and are structurally simple; they migrate as a
batch because they share the template and reviewers can hold all three in one PR
cycle. The only care points are the cross-context touches: seating flips table
status, and promotions discount real orders.

## Design choices

- **Schema**: `Reservation` (status enum per DDD, optional table/zone FKs),
  `VenueEvent` + `EventGuest`, `Promotion` (codes unique per venue,
  `redemptionCount`).
- **Reservation ↔ table** (reservation-service TODO): confirm → table `reserved`;
  seat → `occupied`; cancel/complete → release if still held by this reservation.
  Same transaction as the status write; emits `ReservationSeated` (plan 07 bus).
- **Promotions apply at pricing time**: `validateCode` becomes a real lookup
  (promotions-service TODO); the plan-05 pricing engine gains an optional
  promotion input — discount line before fees, snapshot on the order, increment
  `redemptionCount` **inside the order transaction** (DDD invariant). The guest
  cart gains a promo-code field (small UI addition; the manager validator page
  already exists).
- **Event guestlists** stay event-scoped names (no CRM — per product decision);
  check-in emits `GuestCheckedIn` for future door tooling, nothing else consumes
  it yet.
- **Status derivation**: promotion active/scheduled/expired computed from dates —
  the stored `status` column drops; the expire cron (AD-9) becomes unnecessary →
  removed from the AD-9 example list. Event status stays stored (draft/published
  are editorial states).

## Implementation strategy

1. Schema + migration + seeds (three mock files).
2. Reservations: CRUD swaps → status transitions with table-flip transaction.
3. Events: CRUD + guestlist swaps.
4. Promotions: CRUD swaps → `validateCode` → pricing-engine integration + cart
   field + snapshot/increment.
5. Renames; delete the three service TODOs.

## Testing

- Unit: pricing engine with promotion × happy-hour stacking (define precedence:
  promo applies to the already-discounted price; test pins it); date-window
  derivation for promo status.
- Integration: reservation transitions flip/release table status correctly incl.
  cancel-after-confirm; double-seat same table rejected; promo redemption
  increments exactly once per order, rolls back with the order; guestlist CRUD;
  tenant isolation ×3.
- E2E: manager confirms + seats a reservation → floor map shows the table
  occupied; guest applies a promo code → receipt shows the discount line.

## Review checklist

- Can a reservation seat a table another reservation holds?
- Promo precedence documented in `pricing.ts` (the "won/lost are exits"-style
  constraint comment)?
- Any leftover read of the dropped `Promotion.status` column?

## Exit criteria

Three services real; reservation board drives real table status visible on the
floor map; a promo code changes a real order's total exactly once.
