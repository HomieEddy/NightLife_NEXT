# 14 — Promoters: Role, Mobile Panel & Attribution Analytics · PLAN

**Status: not started — demo track first (AD-14).**

Goal: venues run on promoters — people whose job is to funnel guests into the
club. Today the app can't name them. This plan adds `promoter` as a first-class
staff role with its own mobile experience (reservations CRUD, read-only order
tracking, assigned-only views) and gives the manager the numbers that matter:
which promoter funnels in the most guests, and which one brings the spenders.

Preconditions: plan 08 (reservations service + board), plan 09/09c (analytics +
report engine), plan 13 (reservation channel attribution — promoter is a new
sibling of the embed/direct/walk-in story). Plan 15 (floor-role capability
matrix) shares the role-driven nav seam introduced here; 14 ships the seam,
15 extends it — either can land first, but the seam lives in this plan.

## Reasoning

A promoter is *not* floor crew: they don't deliver bottles or approve tables.
Their unit of work is the **reservation** — they create it, attach a guest,
and get judged on whether that guest shows up and spends. So the design has
one spine: **`promoterId` attribution flows reservation → session → orders**,
and everything else (their panel, the manager's analytics tab, report
metrics) is a view over that chain.

Interpretation choices (stated per §1.4):

- "CRUD on Reservations" = full CRUD **on their own reservations only**
  (create, edit, cancel while still `requested`/`confirmed`). Confirmation
  stays a manager/host action — a promoter must not be able to lock a table
  (plan 13's one-confirmed-per-table-per-night invariant is a claim on venue
  inventory; promoters request claims, the venue grants them). They see other
  reservations for the night read-only, so they don't double-book a table
  blind.
- "Orders assigned to them" = orders belonging to guest sessions attributed to
  their reservations (`session.promoterId`). Same rule for Home and Approvals:
  the promoter's panel is scoped to *their* funnel, not the whole floor.
- "Track orders read-only" = they see status, items and totals ticking up for
  their tables — no claim, no status transitions, no gift actions. A promoter
  watching a whale table spend is the feature.
- "The spenders" = revenue attributed per promoter, plus per-guest average and
  a top-tables list — enough to answer "who brings volume vs. who brings
  whales". Guest identity and CRM ship in Plan 17; this plan measures
  promoter-attributed spend without building the guest profile system.

## Design choices

- **Role**: `StaffRole` gains `"promoter"`; `ASSIGNABLE_ROLES` gains it (the
  manager creates promoters from the existing staff page — no new CRUD
  surface). `RoleBadge`, staff filters and schedule views pick it up via the
  existing role maps. Live mode: exact role lives on `StaffProfile` as today;
  coarse member role stays `member` (appendix rule — org roles are never
  compared against floor roles).
- **Attribution chain**:
  - `Reservation.promoterId?` — set automatically when a promoter creates the
    reservation; settable by the manager on manager-created ones (a promoter
    phones it in). `channel` gains `"promoter"` alongside
    embed/direct/walk-in.
  - `GuestSession.promoterId?` — stamped at seat time from the reservation
    that gated/seated the table (plan 13's PIN seat transition and the
    manager "seat" action both copy it). Sessions without a reservation stay
    unattributed — walk-ins are the control group, not noise.
  - Orders need no new column: `order.sessionId → session.promoterId` is the
    join. `// TODO(backend): promoter revenue = SQL join orders→sessions on
    promoterId, no denormalized column` lives on the analytics read.
- **Promoter panel** = the existing `/staff` app, role-aware — not a new area.
  `StaffShell`'s nav becomes role-driven via a new
  `src/lib/role-capabilities.ts` map (single source: nav items + allowed
  actions per role; plan 15 extends it for runner/security). Promoter nav:
  **Home · Orders · Approvals · Events · Reservations** (+ Chat if
  entitled) — same bar, two additions, per the ask.
  - **Home**: tonight-for-you — their reservation count (requested /
    confirmed / seated), guests in house, attributed revenue ticking, next
    arrivals. Reuses the staff home card patterns.
  - **Orders** (`?mine=1` scoping inside the existing page): read-only cards —
    status timeline visible, action buttons absent for the role (capability
    map, not CSS hiding).
  - **Approvals**: sessions on their tables only, read-only status (the host
    approves; the promoter watches their party get in).
  - **Events** (`/staff/events`, new): the published events list (read-only)
    so they know what they're selling; per-event their own reservation tally.
  - **Reservations** (`/staff/reservations`, new): their book — list grouped
    by night, create/edit/cancel dialogs reusing the manager reservation
    dialog components (extract to `src/components/shared/` — generalize the
    existing instance, don't fork). Creating picks zone/table from
    availability (same read the embed page uses, so a promoter can't offer a
    table already claimed). Cancel gets a `ConfirmDialog` naming the guest.
- **Manager analytics — Promoters tab** after Staff in
  `/manager/analytics` (`TabsTrigger value="promoters"`). Per promoter, over
  the selected range: reservations created → confirmed → seated (funnel with
  show-up rate), **guests funneled** (Σ party sizes seated), **attributed
  revenue**, avg spend per guest, avg spend per party, top table by revenue.
  Leaderboard sorted by revenue with a guests-funneled toggle. Demo: the
  seeded analytics generator extends deterministically (stable hashes, same
  range ⇒ same chart); live: SQL over the attribution join.
- **Custom reports**: `REPORT_METRICS` gains `promoter-funnel` (reservations,
  confirmation + show-up rates, guests) and `promoter-revenue` (attributed
  revenue, avg per guest) — selectable metrics and CSV sections through the
  existing report engine, nothing bespoke.
- **Demo sign-in**: a promoter persona joins `mockPersonas` so the demo
  showcases the panel first-class (the full persona restructure — one button
  per floor role, admin button removal — is plan 15's; this plan only adds
  the promoter identity it needs).
- **Authorization (live graduation)**: route handlers enforce the capability
  map server-side — a promoter token on an order transition or another
  promoter's reservation gets 403. Reservation CRUD routes scope by
  `promoterId = authenticated profile id`; the wrong-role 403 case per §7b.6.

## Implementation strategy

Demo track (sketch, iterate in preview):

1. Types: `"promoter"` in `StaffRole`/`ASSIGNABLE_ROLES`, `promoterId?` on
   `Reservation` + `GuestSession`, `"promoter"` channel,
   `role-capabilities.ts` (nav + action map). Mock data: two promoters
   (contrasting profiles: one volume, one whales), promoter-attributed
   reservations/sessions/orders seeded so every analytics number is non-zero,
   promoter persona in `mock-data/auth.ts`.
2. Services: `reservation-service` promoter scoping (`listMine`, create
   stamps `promoterId`/`channel`); `guests-service` seat-time stamp;
   `staff-service.getCurrentStaff` already returns the persona — panel
   scoping reads from it.
3. Panel: role-driven `StaffShell` nav; `/staff/reservations` +
   `/staff/events`; assigned-only + read-only variants of Home/Orders/
   Approvals driven by the capability map.
4. Manager: Promoters analytics tab; report metrics + CSV sections; promoter
   field on the manager reservation dialog; channel/promoter chip on
   reservation cards.

Live track (graduation, its own PR per the ritual):

5. Prisma migration (`promoterId` columns, channel value, profile role);
   live service branches `satisfies` the mocks; selector wiring; server-side
   capability enforcement; analytics/report SQL; isolation + wrong-role
   tests; drop any demo gates that got real counterparts.

## Testing

- Unit: attribution stamping (reservation→session at seat, both seat paths);
  promoter funnel math (show-up rate = seated/confirmed, guests = Σ party
  size of seated only); revenue attribution sums orders of attributed
  sessions only — walk-in sessions excluded (test-first per §7b.3 — this is
  the money-adjacent number a promoter gets paid on).
- Integration (live): promoter CRUD scoped to own rows (editing another
  promoter's reservation → 403); promoter on order-transition endpoint → 403;
  wrong-role and tenant-isolation canaries on the new routes; report run
  includes promoter sections with correct totals.
- E2E (demo): sign in as promoter → create reservation → manager confirms →
  guest seated → order placed → promoter's Home revenue ticks and manager's
  Promoters tab attributes it.
- Preview drive in both build modes.

## Review checklist

- Can a promoter reach any mutating order/session/help endpoint, or another
  promoter's reservation? (Capability map enforced server-side, not just nav.)
- Does attribution survive the full chain — reservation → PIN seat → session
  → orders — on *both* seat paths (guest PIN, manager seat action)?
- Are walk-in sessions cleanly unattributed (no default-promoter bug)?
- Do promoter revenue numbers round to cents at the service boundary and
  match the sales tab's totals for the same range?
- Nav additions render only for the promoter role; `useSearchParams` under
  `Suspense` on new pages; `next build` green in both modes.

## Exit criteria

A promoter signs into the mobile panel, manages their own reservation book,
watches their tables' orders live without being able to touch them, and sees
only their funnel on Home/Orders/Approvals. The manager opens Analytics →
Promoters and can answer "who funnels the most guests" and "who brings the
spenders" for any date range, and a custom report exports the same numbers.
