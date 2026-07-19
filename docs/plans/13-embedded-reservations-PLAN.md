# 13 — Embeddable Reservations & Reserved-Table QR Gate · PLAN

**Status: demo track complete; live graduation pending** — public reservation
API routes + live selector branch; schema migration is already committed.

Goal: venues get a shareable/embeddable public reservation page — a guest opens
it, sees the floor map with live table availability (min spend, capacity), picks
a table, and requests a reservation. The manager tracks which reservations came
through the embed link vs. other channels. The QR flow gains a reservation
gate: a table with an active confirmed reservation is locked behind a 6-digit
PIN issued to the reserving guest, so a random scan can't hijack the table.

Preconditions: plan 03 (tables/zones/floor positions), plan 06 (guest sessions
+ signed QR tokens), plan 08 (reservations service, table-status flips),
plan 09 (`ReservationAnalytics`). Confirmation delivery (SMS/email) is **out of
scope** — the PIN/confirmation surface is designed so a notifier can be bolted
on later without schema change (`TODO(backend)` marks the seam).

## Reasoning

Two features ride together because they share one invariant: *a reservation is
a claim on a table that the QR flow must respect*. The embed page creates
public claims; the PIN gate enforces them at scan time. Shipping the page
without the gate makes reservations decorative; shipping the gate without the
page gives it nothing to protect beyond manager-created reservations (which it
also protects — the gate keys off reservation status, not source).

Per AD-14 this is born on the demo track: the public page, floor-map picker,
and PIN modal are sketched mock-first and iterated in the preview; graduation
wires the live branches described below. The prototype already did most of the
groundwork — `Reservation.source` distinguishes `"manager" | "public"`,
`VenueTable` carries `minimumSpend`, `seats`, `status`, and floor positions,
and `applyTableStatus` already flips tables to `reserved` on confirm.

Interpretation choices (stated per §1.4):

- "Embeddable" = a standalone public route that works both as a direct link
  and inside an `<iframe>` (no auth chrome, no manager shell, frame-friendly
  headers). We do not build a JS widget/snippet — an iframe of the same page
  is the whole embed story.
- Availability is **per night, per event**: the page is scoped to a date (and
  optionally a `VenueEvent`), and a table is unavailable if a
  confirmed/seated reservation overlaps that night — not merely if its live
  `status` is `reserved` right now (see the double-claim invariant below for
  why `requested` doesn't block).
- Public reservations land as `requested`; the manager confirms them on the
  existing reservations board. Confirmation is what mints the PIN and flips
  the table — the embed page never writes table status directly.

## Design choices

- **Attribution**: split channel out of the overloaded `source` field —
  `Reservation.source: "manager" | "public"` stays (who created it), new
  `channel?: "embed" | "direct" | "walk-in"` records how a public one arrived.
  The embed page always writes `source: "public", channel: "embed"`. Migration
  backfills existing `public` rows as `channel: "direct"`.
- **Contact on the reservation**: add `guestEmail?` / `guestPhone?` to
  `Reservation` (at least one required on the public form). These are the
  future delivery addresses for the PIN — `TODO(backend): send PIN via
  email/SMS on confirm` lives on the confirm transition, nowhere else.
- **PIN**: `reservationPin?: string` (6 digits), generated when a reservation
  with a `tableId` transitions to `confirmed`; cleared on
  seat/cancel/complete. Live mode stores a hash and compares server-side;
  demo mode shows the PIN on the manager's reservation card (its stand-in for
  the unbuilt SMS/email — gated `isDemoMode()`, dies with the notifier PR per
  §9.6). Deterministic in demo (seeded from the reservation id) so preview
  assertions hold.
- **Public route**: `/r/[venueSlug]` (+ `?event=` and `?date=` params, read
  under `Suspense` per the appendix rule). Demo build serves the seeded venue
  at a fixed slug; live build resolves the tenant by slug — `Venue` gains a
  unique `publicSlug`. The page is read-only floor map (reuse the manager
  floor-map rendering, extracted to `src/components/shared/FloorMapCanvas`
  with a `readonly` + `onSelectTable` surface — generalize the existing
  instance, don't fork it) + availability legend + request form
  (name, party size, contact, note). Available tables show
  `formatMoney(minimumSpend)` and seat count; unavailable ones are dimmed and
  unselectable. Manager UI gains a "Copy link / embed snippet" affordance on
  the reservations and events pages (an `<iframe src>` one-liner —
  reversible, one-click, no confirm).
- **New service surface** (mock first, live `satisfies` it):
  `getPublicAvailability(venueSlug, { date, eventId? })` returning zones,
  tables (id, label, seats, minimumSpend, position, available flag) — no
  statuses, no guest names, no PII leaves the venue; and
  `createPublicReservation(...)`. Live: unauthenticated route handlers under
  `/api/public/reservations/*`, venue scoped by slug lookup (the deliberate
  non-cookie tenant entry, same posture as `/api/guest/join`), rate-limited.
- **QR gate**: `POST /api/guest/join` (and its demo counterpart) checks, after
  token verification, for an active confirmed reservation overlapping *now*
  on that table. If one exists and the request carries no valid `pin`, respond
  `409 { reserved: true }` — the guest page shows the "table reserved" modal
  with a PIN field instead of the join form. Correct PIN → session proceeds
  and the reservation auto-transitions to `seated` (which already flips the
  table to `occupied` and clears the lock for the party's later re-scans —
  companions join a seated table normally). Wrong PIN → generic error, small
  attempt limit. Manager "seat" action remains the override for walk-ups who
  lost the code.
- **Night-open cutoff**: the embed link stops accepting reservations for a
  night once that night has opened. A request (and the availability read) for
  business night `D` is rejected when *now*, in the venue's timezone, is at or
  past `D`'s `nightStartHour` — computed from the venue's persisted
  timezone/night config, never a fallback (appendix rule). Because nights span
  midnight, "Friday's night" stays closed through Saturday 04:00, not just
  until midnight: the check is *now ≥ nightStart(D)*, not *date(now) > D*.
  Enforced **server-side in `createPublicReservation`**, not just by hiding
  the form — a page opened at 21:55 must get a clean "reservations for
  tonight are closed" error at 22:05, not a write. The UI mirrors it: past
  cutoff, the page offers the next open night. Manager-created reservations
  are exempt (walk-ups during service are their job); this guard is the
  public channel's only write-window.
- **Double-claim prevention** (the confirm-time race, promoted from checklist
  to design): two `requested` reservations may coexist on one table — that's
  fine, they're inquiries. The invariant is **at most one
  confirmed-or-seated reservation per table per night**
  (`INV: unique(tableId, night) where status in (confirmed, seated)`).
  Enforced at the `confirmed` transition: inside the same transaction that
  writes the status and mints the PIN, lock the table row and check for an
  overlapping confirmed/seated reservation; a second confirm fails with a
  conflict the board surfaces ("VIP-01 already confirmed for tonight").
  Demo mock enforces the same rule synchronously so the UX is identical.
  Availability shown on the embed page filters on confirmed/seated only plus
  the requester's own pending flag — `requested` inquiries don't block the
  map (managers arbitrate), but the cutoff guard above means the map can
  never offer a table for a night already in progress.
- **Metrics**: `ReservationAnalytics` gains a channel breakdown
  (embed / direct / manager: counts, confirmation rate, show-up rate) and the
  events analytics table gains "reservations via embed" per event. Demo:
  seeded generator extends deterministically; live: SQL aggregation like the
  rest of plan 09.

## Implementation strategy

Demo track (sketch, iterate in preview):

1. Types: `channel`, `guestEmail/guestPhone`, `reservationPin`, `eventId?` on
   `Reservation`; `publicSlug` on `Venue`. Mock data extended (some seeded
   reservations get `channel: "embed"` + PINs).
2. Extract `FloorMapCanvas` from the manager floor map (refactor commit, no
   behavior change), then build `/r/[venueSlug]` on it with the availability
   + request-form flow against `mockReservationService`.
3. QR gate in the demo guest flow: reserved-table modal + PIN entry + seat
   transition; demo PIN visible on the manager reservation card.
4. Manager: copy-link/embed affordance; channel chip on reservation cards;
   analytics channel breakdown.

Live track (graduation):

5. Schema migration + backfill; public route handlers `satisfies` the mock
   types; selector wiring; PIN hashing + attempt limiting; join-route gate
   with the seat transition inside the same transaction as the session
   create.
6. Analytics SQL for channel breakdown; embed-friendly headers
   (frame-ancestors policy for `/r/*` only).
7. Remove demo-only affordances that got real counterparts; delete fulfilled
   `TODO(backend)`s; note the SMS/email notifier as the one that remains.

## Testing

- Unit: availability overlap logic (night boundaries via venue
  `nightStartHour` — no hardcoded fallback, fake timers); night-open cutoff —
  test-first per §7b.3, it's a write-window invariant: 21:59 accepted, 22:00
  rejected, and 01:00 *the next calendar day* still rejected for the night in
  progress (midnight-spanning case), all in the venue timezone; PIN
  generate/clear on each status transition; channel backfill mapping.
- Integration: public availability endpoint leaks no guest names/PII and
  scopes by slug-resolved tenant (isolation canary ×2: reservations,
  availability); `createPublicReservation` lands `requested/public/embed`;
  `createPublicReservation` for a night in progress → rejected regardless of
  what the (possibly stale) page showed; two concurrent confirms on one
  table → exactly one succeeds (the transaction test for the invariant);
  join with no PIN on a reserved table → 409, wrong PIN → 403 with attempt
  limit, right PIN → session created **and** reservation `seated` atomically;
  second scan after seating joins without a PIN; join on an unreserved table
  unaffected.
- E2E: embed page → pick table → request; manager confirms (PIN appears in
  demo); guest scans the table QR → PIN modal → correct PIN → menu; floor map
  shows occupied. Random-scan path: PIN modal blocks, no session created.
- Preview drive in **both** build modes (the route split is per-build).

## Review checklist

- Does any public response include guest names, contacts, or PINs of other
  reservations?
- Is the one-confirmed-per-table-per-night invariant enforced inside the
  confirm transaction (row lock), not by a pre-read the race can slip past?
- Is the night-open cutoff checked server-side in the public write path, in
  the venue's timezone, and correct across midnight?
- Is the PIN compared server-side only, and absent from every payload the
  guest page receives before entry?
- Does the reserved-table 409 fire for manager-created reservations too
  (gate keys off status, not channel)?
- `useSearchParams` under `Suspense` on `/r/*`; `next build` green in both
  modes.

## Exit criteria

A venue shares one URL; a guest reserves a specific table from the floor map
with min-spend and capacity visible; the manager confirms it and sees it
attributed to the embed channel in analytics; scanning that table's QR
demands the 6-digit PIN until the party is seated, and a stranger's scan gets
the reserved modal, not a session.
