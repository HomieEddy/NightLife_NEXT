# 18 — Workforce: Time Clock, Scheduling, Tips & Commissions · PLAN

**Status: not started — demo track first (AD-14).**

Goal: staff stop being a roster and become a **workforce with a cost and an
income**. Three moves: (1) replace the `isOnShift` toggle with a real time clock
(dated shift instances, clock in/out, breaks, attendance); (2) turn
`/staff/schedule` from a read-only list into a scheduling workflow (publish,
swap, cover, time-off, no-show); (3) close the money loop that plans 16 and 14
left open — **tip pooling and distribution**, and **promoter commission**, whose
analytics already exist with nothing behind them.

Preconditions: plan 09b (live staff identity — `User` + `Member` +
`StaffProfile`), plan 14 (promoter attribution chain), plan 15 (capability
matrix), plan 16 (tab ledger — tips-by-staff basis, audit trail, cash-out).

Closes: `docs/BUSINESS-LOGIC-GAP-REVIEW.md` §3 in full, and the labour-cost half
of §8.

## Reasoning

`StaffShift` today is a *recurring weekly template*: `dayOfWeek`, `startTime`,
`endTime`, `zoneId`. Nothing in the system knows that last Saturday happened.
That single modelling choice is why there is no attendance, no labour cost, no
swap, no time-off and no payroll basis — and it's why the review ranks clock-in
fifth overall despite it sounding like an HR nicety. Labour is the second-largest
controllable cost in a nightclub after product, and right now the app can report
revenue per staff member without knowing what that staff member cost.

Interpretation choices (per AGENTS.md §1.4):

- **Template and instance are different objects.** `ShiftTemplate` (today's
  `StaffShift`, renamed and kept — it's genuinely useful for generating weeks)
  and `Shift` (a dated instance for one person, with its own status and actuals).
  Generating a week from templates is an explicit manager action, not magic.
- **Clock in/out is honest but not adversarial.** No geofencing, no selfies, no
  biometrics — a nightclub crew will route around all of it, and it's a privacy
  liability. Instead: staff clock themselves, the *manager sees variance*
  (scheduled vs. actual) and can edit with a reason that lands in the audit
  trail. Trust plus visibility beats enforcement.
- **The business night, not the calendar day.** A shift that starts 22:00 Friday
  and ends 04:00 Saturday is **one** shift on Friday's business date. Every
  aggregate here uses `nightStartHour`/`nightEndHour` — this is the single most
  likely place to introduce an off-by-one-night bug, so it gets tests first.
- **Tips are distributed by rule, not by vibe.** A venue configures one pooling
  rule; the app computes shares and produces a statement. **We compute and
  record; we do not pay.** Payment stays outside the app, exactly like guest
  settlement (PRD §4) — the app's job is to make the number defensible.
- **Promoter commission is attribution-based**, riding plan 14's existing
  reservation → session → orders chain. No new attribution work; only the rate,
  the basis and the statement.

## Design choices

### Data model

- **`ShiftTemplate`** — today's `StaffShift`, renamed: `{ id, venueId, staffId,
  dayOfWeek, startTime, endTime, zoneId?, role?, active }`.
- **`Shift`** (dated instance, root) — `{ id, venueId, staffId, businessDate,
  scheduledStart, scheduledEnd, zoneId?, role, status: "draft"|"published"|
  "confirmed"|"in-progress"|"completed"|"no-show"|"cancelled",
  templateId?, publishedAt?, note? }`.
- **`TimeEntry`** (append-only) — `{ id, venueId, shiftId?, staffId,
  clockInAt, clockOutAt?, breaks: BreakEntry[], source: "self"|"manager",
  editedByStaffId?, editReason?, minutesWorked (derived) }`.
  Edits are new rows superseding old ones (`supersedesId`), never mutations —
  same ledger discipline as everywhere else in this codebase.
- **`BreakEntry`** — `{ startedAt, endedAt?, paid: bool }`.
- **`TimeOffRequest`** — `{ id, venueId, staffId, startDate, endDate, reason,
  status: "requested"|"approved"|"denied", decidedByStaffId?, decidedAt? }`.
- **`ShiftSwapRequest`** — `{ id, venueId, shiftId, requestedByStaffId,
  offeredToStaffId?, status: "open"|"claimed"|"approved"|"denied"|"withdrawn",
  claimedByStaffId?, decidedByStaffId? }`. Open swaps are visible to
  same-role staff; a manager always approves the final assignment.
- **`StaffProfile`/`StaffMember`** gains `hourlyRateCents?`,
  `tipPoolWeight` (default 1.0), `employmentType: "hourly"|"salaried"|
  "contractor"|"commission"`, and for promoters `commissionRule`.
- **`TipPoolRule`** (venue config) — `{ id, venueId, name, basis:
  "hours-weighted"|"equal"|"role-percentage", rolePercentages?:
  Record<StaffRole, number>, includeRoles: StaffRole[], houseRetentionPct: 0,
  active }`. `houseRetentionPct` exists as a field but defaults to 0 and is
  flagged in the UI — tip retention is illegal in many jurisdictions and the
  field should make a venue think, not make it easy.
- **`TipDistribution`** (append-only, per business date) —
  `{ id, venueId, businessDate, ruleId, poolCents, lines: { staffId, basisValue,
  shareCents }[], computedAt, closedByStaffId }`. Computed from plan 16's
  tips-by-staff basis; sums exactly to `poolCents` with remainder cents
  distributed largest-remainder (same discipline as `evenShares()`).
- **`CommissionRule`** — `{ id, venueId, staffId?, appliesToRole?, basis:
  "net-revenue"|"table-minimum"|"per-head"|"per-reservation", ratePct?,
  flatCents?, qualifier?: { minPartySize?, channels?: ReservationChannel[] } }`.
- **`CommissionStatement`** (append-only) — `{ id, venueId, staffId, periodStart,
  periodEnd, lines: { sourceType, sourceId, basisCents, earnedCents }[],
  totalCents, status: "draft"|"approved", approvedByStaffId? }`.

### Behaviour

**Clock — the staff side, one tap:**

- Staff Home gains a **clock card**: "Clock in" → running timer → "Break" →
  "Clock out". It's the first thing on the screen when a shift is scheduled
  within ±2h and nothing else is in flight.
- Clocking in without a scheduled shift is allowed (someone always gets called
  in) and flags the resulting `TimeEntry` as unscheduled for the manager.
- **Auto-close guard**: a `TimeEntry` still open `nightEndHour + 4h` later is
  flagged, not silently closed — a forgotten clock-out is a real event a manager
  must see and resolve with a reason.
- `isOnShift` becomes **derived** (`an open TimeEntry exists`) and the manual
  toggle is retired from the live build (demo keeps a simulate control per
  AD-14/R7).

**Schedule — the manager side:**

- `/manager/staff` gains a **Schedule** workspace (extending the existing
  `schedule-tab.tsx`): week grid by staff × night, generate-from-templates,
  drag-free assignment (tap a cell → assign), **Publish week** as a single
  consequential action with a `ConfirmDialog` naming the week and headcount.
- **Coverage rules** (`ZoneCoverageRule`: min staff by role per zone per night)
  and a **coverage warning** shown while scheduling and again live: a
  `zone-uncovered` attention item when a zone has open orders and no clocked-in
  runner or bartender. The review notes the data for this already exists
  (`assignedZoneIds` + live order load) — this is the cheap win of the plan.
- **Labour cost live**: scheduled labour cost for the night, actual so far, and
  labour % of net revenue on the dashboard's Snapshot tab.

**Staff schedule surface** (`/staff/schedule`, upgraded from plan 15's
read-only list): my published shifts, request time off, offer a swap, claim an
open swap, see who else is on tonight.

**Tips:**

- `/manager/tips` (or a tab on cash-out): the night's tip pool from plan 16's
  basis, the active rule, the computed per-person shares with their basis
  (hours worked, weight, role %), and **Close distribution** — which freezes a
  `TipDistribution` row and writes an audit entry. Staff see their own share on
  their schedule page after close.

**Commissions:**

- `/manager/staff/[id]` gains a commission tab for promoters (and any
  commission-type employee); `/manager/promoters` (plan 14's analytics) gains a
  **statements** view: period, attributed reservations/sessions, basis, earned.
  Approving a statement is consequential + audited. Plan 14's analytics stop
  measuring something the system can't settle.

### Capability matrix additions

| Action | manager | host | bartender | runner | security | promoter |
|---|---|---|---|---|---|---|
| `time:clock-self` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `time:edit-others` | ✓ | — | — | — | — | — |
| `schedule:publish` | ✓ | — | — | — | — | — |
| `schedule:request-swap` / `:request-time-off` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `schedule:approve-swap` / `:approve-time-off` | ✓ | — | — | — | — | — |
| `tips:close-distribution` | ✓ | — | — | — | — | — |
| `tips:read-own` | all roles | | | | | |
| `commission:approve` | ✓ | — | — | — | — | — |

`time:edit-others`, `tips:close-distribution` and `commission:approve` are
`sensitive: true` and audited (plan 16).

### Analytics

New metrics into the existing engine (plan 09c's mechanism): hours worked by
role/night, labour cost and labour % of net revenue, scheduled-vs-actual
variance, attendance rate, no-show and late rate, revenue per labour hour, tips
per hour by role, commission cost as % of attributed revenue. **This is the plan
that makes every existing revenue report a margin report on the labour side**;
plan 19 does the product side.

## Implementation strategy

Demo track:

1. **Types + pure math (test-first)**: `ShiftTemplate`/`Shift` split,
   `TimeEntry`, tip pool math, commission math, `minutesWorked` with breaks,
   business-date bucketing, `generateWeekFromTemplates()`,
   `computeCoverageGaps()`.
2. **Mock services**: `time-service`, extensions to `staff-service` (shifts,
   swaps, time off, publish), `tips-service`, `commission-service`.
3. **Mock data**: a published current week plus last week's completed shifts
   with realistic variance (two late clock-ins, one no-show, one open swap), so
   every screen has a story on first paint.
4. **UI**: staff clock card, upgraded `/staff/schedule`, manager schedule
   workspace, coverage rules in settings, `/manager/tips`, commission tabs,
   dashboard labour metrics.
5. **Pulse**: `zone-uncovered`, `clock-out-missing` attention types.
6. Demo-gate the manual `isOnShift` toggle; derive it live.

Live track (graduation):

7. Prisma models; `time_entries` and `tip_distributions` INSERT-only; unique
   partial index preventing two open `TimeEntry` rows per staff member (the
   double-clock-in bug, prevented in the schema rather than in a handler).
8. Route handlers + Zod; domain events `ShiftPublished`, `ClockedIn`,
   `ClockedOut`, `SwapRequested`, `TipsDistributed` so the manager's schedule
   and coverage warnings update live.

## Testing

- **Unit (test-first):** minutes worked with unpaid breaks and an overnight
  boundary; a shift spanning `nightEndHour` bills to the correct business date;
  tip shares sum exactly to the pool for every rule basis, including a
  three-person pool of $100.01; hours-weighted shares with a zero-hour member;
  commission on a reservation that no-showed earns nothing; coverage gap
  detection with a staff member clocked in but assigned to another zone.
- **Invariant canaries:** `INV-W1` at most one open `TimeEntry` per staff
  member; `INV-W2` Σ `TipDistribution.lines.shareCents` === `poolCents`;
  `INV-W3` a `TimeEntry` is never mutated (supersede-only); `INV-W4` published
  shifts cannot be deleted, only cancelled.
- **Integration (live):** wrong-role 403 on publish/approve/close; a staff member
  cannot clock in as someone else (identity comes from the session, never the
  payload — assert with a spoofed `staffId` in the body); tenant isolation on
  every route; concurrent double clock-in → one succeeds.
- **E2E (demo):** manager generates and publishes next week → runner sees their
  shifts, requests a swap → bartender claims it, manager approves → runner clocks
  in, takes a break, clocks out → manager sees actual vs. scheduled and the
  night's labour % → closes the tip distribution → runner sees their share.

## Review checklist

- Is `isOnShift` derived everywhere in live paths, with no residual writes?
- Does any aggregate use a calendar date instead of the business night? Grep the
  new code for `toDateString`, `startOfDay`, `getDay()`.
- Do tip shares always sum exactly — including the remainder-cent path — and is
  the remainder rule documented at the function?
- Can a staff member's clock action ever be attributed to a different person
  (payload-supplied ids)?
- Is `houseRetentionPct` surfaced with a warning rather than as a neutral field?
- Does the coverage warning use *clocked-in* staff, not scheduled staff?

## Exit criteria

A manager builds next week from templates, publishes it, and the crew sees it on
their phones. People clock themselves in and out; the manager watches the night's
labour percentage move in real time and gets warned when the VIP zone has orders
and nobody clocked into it. At close, the tip pool splits by a rule anyone can
explain, the promoter's commission statement lists the exact reservations it came
from, and every manual edit to someone's hours has a name and a reason attached.
