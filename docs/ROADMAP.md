# ROADMAP — Backend Implementation

Order follows AGENTS.md §9.4 (riskiest-cheapest first), extended with the
foundation and auth prerequisites. Each feature has a full plan in `docs/plans/`;
nothing starts without its plan's "Preconditions" satisfied. The app runs in a
mixed state throughout — some services real, some mock — because every step swaps
method bodies behind a stable interface (R1).

## Sequence

| # | Feature | Plan | Depends on | Risk | Consumes TODOs in |
|---|---------|------|-----------|------|-------------------|
| 01 | Foundation: Postgres, Prisma, scoped client, cents, test infra, seeds | [01-foundation-PLAN](plans/01-foundation-PLAN.md) | — | Low | `types.ts` |
| 02 | Authentication & authorization | [02-authentication-PLAN](plans/02-authentication-PLAN.md) | 01 | Med | `auth-service`, `auth-context`, `admin-gate`, `staff/layout`, `staff-edit-dialog` |
| 03 | Venue, zones & tables | [03-venue-zones-tables-PLAN](plans/03-venue-zones-tables-PLAN.md) | 01, 02 | Low | `venue-service`, `settings`, `qr` (tokens land in 06) |
| 04 | Menu, inventory & packages | [04-menu-inventory-PLAN](plans/04-menu-inventory-PLAN.md) | 03 | Med | `menu-service` (ledger), `inventory`, `menu` pages |
| 05 | Orders & fees (CORE) | [05-orders-fees-PLAN](plans/05-orders-fees-PLAN.md) | 04 | **High** | `orders-service`, `cart-contents`, `happy-hour` pricing, `package-card` |
| 06 | Guest sessions, QR tokens & help | [06-guest-sessions-help-PLAN](plans/06-guest-sessions-help-PLAN.md) | 05 | Med | `guests-service`, `guest-context`, `g/[tableCode]`, `approvals` |
| 07 | Realtime & floor pulse | [07-realtime-pulse-PLAN](plans/07-realtime-pulse-PLAN.md) | 05, 06 | Med | all 6 polling TODOs, `pulse-service`, `show-queue-service`, `staff-service` chat |
| 08 | Reservations, events & promotions | [08-reservations-events-promotions-PLAN](plans/08-reservations-events-promotions-PLAN.md) | 03, 05 | Low | `reservation-service`, `events-service`, `promotions-service` |
| 09 | Analytics & report engine | [09-analytics-reports-PLAN](plans/09-analytics-reports-PLAN.md) | 05 | Med | `analytics-service`, `report-service`, `mock-chart` |
| 09b | V1 operational closure | [09b-v1-operational-closure-PLAN](plans/09b-v1-operational-closure-PLAN.md) | 02–07, 09 | Med | category/add-on ordering, live `staff-service`, session/table closure, venue time, strict mode isolation, fulfilled migration markers |
| 10 | Platform admin & billing | [10-platform-admin-billing-PLAN](plans/10-platform-admin-billing-PLAN.md) | 02, 09b | Med | `admin-service`, `billing-service`, `subscription`, `pricing`, `lead` pages |

Rationale for the two deviations from a naive order: **auth before venue CRUD**
because R2 (tenant scoping) needs a session to scope by, and retrofitting auth
under live features is the classic trap; **orders before guest sessions** because
the order transaction (money + inventory, INV-O2/O4) is the highest-risk work and
deserves the team's freshest attention — sessions then attach to a proven core.

Plan 09b is a corrective checkpoint, not a new product area: it closes live-mode
identity, table-lifecycle, venue-time, fail-closed mode/resource isolation and
failure-recovery seams found after plans 01–09 were integrated. It precedes plan
10 so the platform graduation flow does not provision and bill a tenant whose
core night still depends on seeded staff, simulation controls, mock services or
hard-coded operating assumptions. Its one product addition—category/package
washer and presentation presets—follows the permanent demo-first lifecycle inside
the plan: accepted mock UX first, tested backend graduation second.

## Demo co-existence (AD-14) — how to read the plans

The mocks are **not retired**: they power the public Live Demo permanently. So
wherever a plan says "swap the body of `mockXService.m`" or "rename
`mockXService → xService`", read instead:

1. implement `realXService.m` declared `satisfies XService`
   (where `type XService = typeof mockXService`),
2. wire it through the `src/lib/services/x-service.ts` selector,
3. leave `mockXService` untouched (it stays demo + fixture source),
4. gate — don't delete — any simulation the feature obsoletes
   (`isDemoMode()`), and
5. `TODO(backend)` deletion still applies: the TODO is fulfilled by the real
   implementation existing, even though the mock line it sat on survives —
   move the comment's intent into the plan's exit note if context would be lost.

Every step ordering, test list and exit criterion in the plans remains valid
under this reading. Plan 01 ships the selector/mode infrastructure.

## Ongoing: demo-first feature lifecycle

Plans 01–10 graduate the *existing* features. New features — during and after
the migration — follow the permanent loop (AD-14):

1. **Sketch in the sandbox**: mock data → mock service → UI, demo mode,
   Phase-1 rules. `TODO(backend)` annotations record backend intent.
2. **Iterate until the UX is settled** — the demo build is the review
   environment; killing a feature here costs zero backend work.
3. **Demo-only gate**: entry points behind `isDemoMode()` until graduated —
   the live build never shows a feature without a real backend.
4. **Graduate**: write the next `docs/plans/NN-featurename-PLAN.md` (same
   template: reasoning, design choices, implementation strategy, testing,
   review checklist, exit criteria), implement the real branch, wire the
   selector, drop the gate — one PR, this definition of done.

Numbering continues from 11. UI sketching for new features can proceed in
parallel with backend plans — the two tracks only meet at graduation.

## Definition of done — every feature, no exceptions

1. Plan's design followed or the plan updated in the same PR with why.
2. Real service implemented `satisfies` the mock's type and wired through the
   selector; **call sites and mock untouched** (R1, AD-14).
3. Simulations it obsoletes gated behind `isDemoMode()` in the same PR (R7);
   the demo build still exercises them.
4. Tests per AGENTS.md §7 Phase 2 — money/state-machine units *before* the
   implementation, route-handler integration incl. tenant-isolation attempts,
   the plan's named E2E flow.
5. `TODO(backend)` comments it fulfils deleted in the same commit (§9.2).
6. Verification ladder green (§5): tsc, eslint, suite, preview drive, build.
7. AGENTS.md / this roadmap edited if the feature made either stale (§9.9).

## Phase 3 parking lot (not planned, recorded so they stop haunting scope talks)

Guest card payments (Stripe Connect) · multi-venue owner accounts · POS/KDS
integrations · printer hardware · native apps · offline mode · RLS
defense-in-depth (AD-3) · real charting lib (`mock-chart` TODO).
