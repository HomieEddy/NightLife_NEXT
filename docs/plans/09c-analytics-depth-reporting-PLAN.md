# 09c — Analytics Depth & Reporting Expansion · PLAN

**Status: complete except scheduled email delivery** — same unshipped leg as
plan 09; metrics, saved reports and CSV landed. See ROADMAP parking lot.

Goal: capture in-depth metrics for the domains plan 09 left uncovered —
sessions, reservations, happy hours, events, promotions — deepen the existing
staff / order / inventory metrics, and expose every new metric through the
report engine (saved reports, CSV, scheduled email).

Preconditions: 08 (reservations/events/promotions live), 09 (rollups + report
engine), 09b (live staff identity, session/table closure, venue night config).

## Reasoning

Plan 09 made the numbers real but kept the prototype's *scope*: revenue, zones,
top items, staff delivery, category depletion. Meanwhile plans 05–09b shipped
rich operational data that no analytics read touches: session lifecycles with
settlement methods, a reservation funnel, happy-hour pricing, event guestlists,
promotion snapshots on orders, help requests, sold-out events, shifts. This
plan is pure aggregation over data that already exists — with one deliberate
exception (happy-hour attribution, below) where the source data is not yet
recorded. No new product surface; the analytics page and report engine grow
sections, they don't change shape.

Per AD-14 this is a both-tracks feature: the mock analytics generator gains the
same sections (deterministically seeded) so the demo shows the depth, and the
live branch computes them from real rows.

## Design choices

### Metric catalogue (what "in-depth" means, per domain)

- **Sessions** — sessions per night; approval funnel (pending → approved /
  denied rates); avg approval wait; avg session duration (createdAt → closed);
  avg party size; revenue per session and per guest (covers); settlement-method
  mix (terminal/cash/house); closure-request → closed time.
- **Reservations** — funnel counts (requested → confirmed → seated →
  completed) with conversion rates; cancellation rate; no-show rate (confirmed,
  startsAt passed, never seated); booking lead time (createdAt → startsAt);
  covers (Σ partySize seated); source split (manager vs public); party-size
  distribution.
- **Happy hours** — per rule: orders and revenue inside the window, discount
  given, category uplift vs the same hours on non-HH nights. **Requires new
  attribution**: pricing currently bakes the discount into `unitPrice` with no
  record. Add an order snapshot (`happyHourRuleId?`, `happyHourCents?` —
  order-level sum, same pattern as `promotionId`/`promotionCents`) written by
  `pricing.ts` at order time. Types + mock first, Prisma columns in the same
  workstream. Nights before the column exist simply report zero — acceptable,
  documented.
- **Events** — per event: attendance funnel (invited → confirmed → checked-in),
  capacity utilization (checked-in Σ partySize / capacity), guestlist
  conversion; revenue during the event window (zone-scoped when `zoneId` set)
  vs the venue's average for that weekday — the "did the event pay" number.
- **Promotions** — per code: redemptions in range, discount cost
  (Σ `promotionCents`), attributed revenue, AOV with vs without promo. All from
  existing order snapshot fields; `redemptionCount` on `Promotion` stays the
  live counter, analytics recomputes from orders (source of truth).
- **Staff (deepen)** — split fulfilment into claim wait (placedAt → claimed)
  and delivery time (claimed → delivered); help-request resolutions per staff
  and avg resolution time; per-role aggregates; orders per shift-hour where
  shift data exists.
- **Orders (deepen)** — status funnel with cancellation rate; tip rate and avg
  tip; service-fee revenue (Σ `serviceFee`, per fee via `feeBreakdown`);
  gift-order count and revenue; modifier attach rate; hour × weekday revenue
  heat (historical only).
- **Inventory (deepen)** — sell-through per category (sold / (sold + on hand));
  sold-out events per night and total sold-out minutes (from `SoldOutEvent`);
  restock vs sale unit ratio; dead items (in stock, zero sales in range).

### Architecture

- **Rollup JSONB, not new tables.** `NightlyRollup` gains nullable JSONB
  columns: `sessions`, `reservations`, `happyHours`, `events`, `promotions`,
  and the existing `staffPerformance` / `categoryDepletion` shapes gain fields.
  Every section keeps the versioned envelope (`{ v, ... }`); expanded existing
  sections bump to `v: 2` with **additive** fields only. Readers treat a
  missing section or missing field as zeros — old rows stay readable, no
  backfill migration required (the dev backfill script regenerates them).
- **`queryNightStats` stays the single aggregator** — tonight and the rollup
  job both read through it (plan 09's review invariant). New sections are
  computed there from `GuestSession`, `Reservation`, `VenueEvent`+`EventGuest`,
  `HelpRequest`, `SoldOutEvent`, and order snapshot fields, all night-window
  scoped via `night.ts`.
- **Types**: new interfaces in `types.ts` (`SessionAnalytics`,
  `ReservationAnalytics`, `HappyHourAnalytics`, `EventAnalytics`,
  `PromotionAnalytics`, plus extended staff/order/inventory points).
  `AnalyticsSummary` and `HistoricalAnalytics` gain these as fields — same
  shapes both tracks, cents → dollars at the boundary as today.
- **Mock generator**: `mock-data/analytics.ts` gains seeded literals for the
  new sections; `mockAnalyticsService.getHistorical` scales them with the same
  `seeded()` hash approach — deterministic, no `Math.random`.
- **Analytics page**: new sections slot into the existing tab/card layout
  (reuse `MockChart`, stat cards, `EntityChip` links to
  reservations/events/promotions pages). No new dependencies.
- **Report engine**: `REPORT_METRICS` grows ids — `sessions`, `reservations`,
  `happy-hours`, `events`, `promotions`, `service-fees`, `order-funnel` — each
  mapped to a CSV section renderer in `report-core.ts` (one section per metric,
  same escaping rules). Saved-report CRUD, scheduling, email delivery are
  untouched; they already iterate `metrics[]`. Existing saved reports keep
  working (ids are additive).

## Implementation strategy

1. **Types + mock data + mock services** (demo track first): new interfaces,
   seeded mock sections, `mockAnalyticsService` returns them; analytics page
   renders the new sections; `REPORT_METRICS` + mock CSV sections. Iterate the
   UX in the preview here.
2. **Happy-hour attribution**: `Order.happyHourRuleId`/`happyHourCents` in
   types, mock pricing, Prisma schema + migration, live `pricing.ts` snapshot.
   (Unit tests first — money math.)
3. **Live aggregation**: extend `queryNightStats` + `RollupData` + `upsertRollup`
   with the new sections; `getSummaryForVenue` / `getHistoricalForVenue` merge
   them (missing-section = zeros); dev backfill generates plausible
   sessions/reservations/promo orders so history demos well.
4. **Report engine**: metric-id → rollup-section mapping, CSV renderers,
   scheduled-email path picks them up for free.
5. Docs: ROADMAP row, AGENTS.md untouched (nothing here changes its claims).

Checkpoint `npx tsc --noEmit` after each workstream; ladder per §5 at the end.

## Testing

- Unit: each new aggregation against a fixture night with hand-computed
  answers (funnel rates, no-show detection, HH discount sums, event
  utilization, fee totals — cents exact); CSV rendering for every new metric id
  incl. escaping; happy-hour snapshot math in `pricing.ts` *before* the code.
- Integration: rollup idempotency still holds with new sections; a **v1 rollup
  row** (no new sections) reads back as zeros without throwing; tenant
  isolation on every new query path (`expectTenantIsolation`); wrong-role 403
  on the analytics/report routes unchanged.
- E2E: place an order with a promo code → analytics promotions section and a
  `promotions` report CSV both show the redemption and discount; run a saved
  report containing only new metric ids → CSV downloads with those sections.

## Review checklist

- Does any new metric bypass `queryNightStats` (tonight and rollup must not
  disagree)?
- Are all expanded JSONB fields additive with a `v` bump, and does every reader
  default missing sections/fields to zeros?
- Happy-hour + promotion discounts: rounded to cents at the service boundary,
  never in JSX; no double-count when both apply to one order.
- No-show / funnel definitions consistent between tonight, rollup, and CSV
  (one function each, not three).
- Demo build shows all new sections with seeded data; live build shows real
  data; neither leaks the other's path.

## Exit criteria

Analytics page (both builds) shows the five new domain sections plus deepened
staff/order/inventory metrics; every new metric selectable in a saved report
and present in the CSV and scheduled email; dev backfill produces 90 nights of
history covering the new sections; suite green; ROADMAP updated.
