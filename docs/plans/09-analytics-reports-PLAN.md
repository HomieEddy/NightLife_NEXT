# 09 — Analytics & Report Engine · PLAN

**Status: complete except scheduled email delivery** — cron handlers + Resend
never landed (rollups, due-selection and `job_runs` exist); see ROADMAP
parking lot.

Goal: every number derives from real orders (R8) — live "tonight" queries, a
nightly rollup for history, and a report engine with scheduled email delivery.

Preconditions: plan 05 (real orders to aggregate). Plan 07 helps but isn't
required — analytics reads are pull-shaped.

## Reasoning

The seeded generator (`analytics-service`) was the right prototype move and is now
the biggest lie on the dashboard. Replacing it last-but-one is deliberate: by now
orders, sessions and movements carry months of… nothing — so the plan includes a
**dev-only history backfill** so charts demo well before real history accrues.

## Design choices

- **Tonight = live SQL** over `Order`/`HelpRequest`/`VenueTable` with the
  "business night" boundary defined once (`src/server/night.ts`: a night spans
  venue-local 18:00 → 10:00 next day; unit-tested; used by dashboard, rollups and
  last-call analytics alike). Indexed per plan 05.
- **History = `nightly_rollups`** (AD-11): one row per venue-night with the
  aggregates the analytics page shapes need (revenueCents, orders, byZone JSONB,
  topItems JSONB, staffPerformance JSONB, categoryDepletion JSONB). Written by an
  idempotent cron job (AD-9) that recomputes the just-ended night; backfillable by
  date range (powers the dev backfill).
- **Service mapping**: `getSummary()` → tonight SQL; `getHistorical(from,to)` →
  rollup range read + the same shaping (`aggregateWeekly` stays client-side, it's
  presentation). Response shapes unchanged (R1) — cents→dollars at the boundary.
- **Report engine**: `SavedReport` table (metrics[], rangeDays, schedule);
  on-demand runs query rollups; CSV rendered server-side (the current client CSV
  builder moves over near-verbatim); `markRun` becomes `report_runs` rows.
  **Scheduled runs** = cron job selecting due schedules → run → Resend email with
  CSV attached (report-service TODO). Frequency semantics documented: daily=every
  morning after rollup, weekly=Mon, monthly=1st.
- **Dev backfill**: `prisma/backfill-nights.ts` generates plausible historical
  orders (deterministic seed per AGENTS.md §7 — no `Math.random` in anything
  asserted) then rolls them up. Dev/preview only; guarded from prod.

## Implementation strategy

1. `night.ts` + unit tests (DST edges, the 18:00/10:00 boundary).
2. Tonight queries + `getSummary` swap; dashboard/Pulse unchanged visually.
3. Rollup table + job + backfill; `getHistorical` swap; analytics page against
   real ranges.
4. Report engine: schema, run path, CSV endpoint, swaps, cron schedule, email.
5. Renames; delete analytics/report TODOs. (`mock-chart` swap-for-recharts TODO
   explicitly **stays** — Phase 3 parking lot.)

## Testing

- Unit: night-boundary function; rollup aggregation math against a fixture set of
  orders with known totals (assert cents exactly); CSV escaping.
- Integration: rollup idempotency (run twice = same row); job records `job_runs`;
  scheduled-report selection logic (due/not-due matrix); summary matches a
  hand-computed seed night; tenant isolation on rollups and reports.
- E2E: place an order as guest → manager dashboard revenue increases by its total
  (the R8 smoke test); run a saved report → CSV downloads with tonight's order in
  it.

## Review checklist

- Do dashboard "tonight" and the rollup job agree on the night boundary (shared
  function, no reimplementation)?
- Any prod path into the backfill script?
- Are JSONB rollup shapes versioned (a `v` field) so shape changes don't corrupt
  old rows?

## Exit criteria

Dashboard/analytics/reports all real; demo environment backfilled with 90 nights;
scheduled report lands in a mailbox in preview; generator code deleted.
