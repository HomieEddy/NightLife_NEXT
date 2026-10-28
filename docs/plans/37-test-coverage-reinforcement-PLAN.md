# 37 — Test Coverage Reinforcement · PLAN

**Status: in progress — coverage gate installed (Phase 9, executes before plan 36).**
**Numbered 37** per the ROADMAP plan index ("numbering restarts at 37 for the
next new plan"); plan 36 keeps its number — `docs/plans/36-cicd-deployment-PLAN.md`
exists and is referenced across RUNBOOK/SECURITY/ARD.

Goal: turn the test suite's breadth into a measured, enforced v1 floor —
**70% statements / 60% branches / 65% functions** on scoped live-track code,
per-file floors on the money and state-machine cores, and the missing §7.3 E2E
flow added — so that when plan 36 wires CI, the gate it enforces is a real
number, not an aspiration.

Preconditions: Phase 8 complete. This plan runs **before plan 36**: plan 36's
check job includes the coverage gate installed here (cross-ref added to
`36-cicd-deployment-PLAN.md` in this PR). Branch `chore/37-test-coverage`.

## Baseline — measured 2026-08-09 (@vitest/coverage-v8)

No coverage config exists today: `@vitest/coverage-v8` is installed but
`vitest.config.ts` has no coverage section and no script runs it. Ran the
suite by hand to get the starting point:

| Run | Statements | Branches | Functions | Lines |
|-----|-----------|----------|-----------|-------|
| unit, whole `src/` | 54.8% | 40.8% | 50.3% | 57.1% |
| unit, demo track excluded | 59.7% | 42.4% | 56.5% | 61.0% |
| integration (PGlite) | 62.2% | 50.4% | 63.1% | 67.5% |

The suite is broad (80+ files, ~4,300 unit statements) and the §7.1 cores are
already strong — `fees` 88.7, `lib/tab` 96.2, `lib/workforce` 89.6, `door` 98.3,
`night` 96.8, `permissions` 91.7, `seed-corpus` 96.2, `venue/core` 93.3. But
whole services run untested, and branches at 42% means the denial paths —
row locks, rollbacks, forbidden transitions — are the untested half. That is
exactly where a nightclub loses money.

**Measured gaps, named (file — statements, project):**

| File | % | Project | Why it matters |
|---|---|---|---|
| `ordering/costs.ts` | 29.5 | unit | money math |
| `platform/purchasing-core.ts` | 30.4 | unit | money (POs, stocktakes) |
| `workforce/time-core.ts` | 31.4 unit / 66.7 int | both | timesheets are money |
| `realtime/events.ts` | 15.6 | unit | SSE/LISTEN-NOTIFY domain events |
| `shared/api-error.ts` | 0 | unit | the error seam plan 31 built |
| `shared/order-status.ts` | 33.3 | unit | order state machine |
| `workforce/staff-core.ts` | 7.1 unit / 82.1 int | integration owns it | floor it where it's covered |
| `shared/db.ts` | 3.1 unit | integration owns it | tenant-scoping extension (AD-3) — the scoping suites are the real coverage |
| `lib/happy-hour.ts` | 0 int | integration | money (pricing windows) |
| `lib/order-line.ts` | 0 int | integration | money |
| `lib/tab.ts` | 27.8 int | integration | the tab ledger itself |
| `workforce/tips-core.ts` | 25.9 int | integration | money distribution |
| `lib/pulse.ts` | 45.9 | unit | emergency/attention alerting |
| `shared/logger.ts` | 57.1 | unit | plan 32's pino seam |
| `lib/order-presentation.ts` | 37.5 | unit | receipt/order rendering math |

Demo-track files (mock services, mock data, `src/app/**`, `src/components/**`)
are deliberately absent from this list — they are the fixture layer by design
(AGENTS.md §7) and are excluded from the gate, not debt.

## Reasoning

The repo's testing philosophy is behavioral, and it is working: money math and
state machines get tests, every tenant-owned suite carries isolation canaries,
every role-gated endpoint gets a wrong-role 403. What it lacks is a floor.
"Don't chase coverage numbers" was never "don't measure" — the gate this plan
installs is scoped precisely so it measures what §7 says matters and ignores
what it says doesn't. Without it, plan 36's pipeline enforces tsc/eslint/tests
but nothing stops a merge that deletes the fees tests or ships an untested
ledger method. The CI gate needs a number it can fail on.

## Design choices

1. **Scoped thresholds, not whole-repo.** The gate excludes demo track:
   `**/*-mock-service.ts`, `**/*-mock-data.ts`, `src/app/**`,
   `src/components/**`, `src/i18n/**`. Included: `src/features/**` live-core
   files and `src/lib/**`. Explicit per-project `include` lists with
   `all: true` — a file no test touches counts against the gate instead of
   vanishing from the report (today's numbers are polluted by files the
   suite never imports).
2. **Per-project ownership.** Unit floors the pure math and lib cores;
   integration floors live services, routes, DB scoping. A file is floored
   where its coverage actually comes from — `lib/door.ts` is 98.3% in unit
   and 45.8% in integration; flooring it in integration would lie about the
   file. The `staff-core`/`db.ts` rows above are the pattern to follow.
3. **Targets: 70 / 60 / 65 (statements / branches / functions) on both
   scoped projects.** Branches is the money metric — denial paths. 70 is
   reachable: the gap list is ~15 files with names, not a rewrite.
4. **Per-file floors on the money cores** (vitest `thresholds.perFile`):
   floors lock wins and catch drift at the file, not the aggregate — one
   untested ledger method is invisible in a 70% average. Already-≥90 files
   floor at today's measured value; named money files floor at ≥80; a new
   floor lands in the same commit as the tests that earn it, never before.
5. **`test:coverage` script** — `vitest run --coverage` (both projects).
   `npm run test` stays the fast dev loop; plan 36's CI check job runs the
   coverage variant. The coverage run measured ~90 s unit + ~30 s
   integration — inside the ~5-minute CI budget plan 36 sets.
6. **No `/* v8 ignore */` bypass valves** without a written reason on the
   same line (test-only adapters, provably unreachable branches). A bare
   ignore is a coverage hole with plausible deniability.
7. **E2E completion:** the third §7.3 flow — admin provision → manager
   onboarding — lands as `e2e/admin-provision.spec.ts` (live mode,
   two-context pattern from `live-night.spec.ts`). E2E stays out of the PR
   gate per §7b.8.
8. **Isolation canaries + wrong-role 403s stay law** (§7b.6). This plan
   re-verifies presence across every tenant-owned suite (grep, don't
   assume) and adds missing cases; it does not invent new policy.

## Implementation strategy

1. **Config first:** per-project coverage in `vitest.config.ts` (include
   lists, `all: true`, thresholds at target), `test:coverage` script. Run
   it — that run is the honest gap list.
2. **Close gaps in risk order:**
   a. **Money:** `costs.ts` 29.5, `lib/happy-hour.ts` 0, `lib/order-line.ts`
      0, `lib/tab.ts` 27.8 int, `tips-core` 25.9 int, `time-core`,
      `purchasing-core` 30.4.
   b. **State machines & safety:** `order-status.ts` 33.3, `events.ts`
      15.6, `pulse.ts` 45.9.
   c. **Services & plumbing:** `staff-core` (integration floor only),
      `db.ts` (integration scoping suites — verify, don't rebuild),
      `api-error.ts` 0, `logger.ts` 57.1, `order-presentation.ts` 37.5.
3. **Floor each named money file** at ≥80 (≥90 where already there) in the
   commit that lifts it.
4. **E2E admin provision → onboarding spec**, live mode.
5. **Docs, same PR:** AGENTS.md §7 gains the gate + demo-exclusion sentence
   (§9.9 same-PR rule — the gate is a change to the testing philosophy it
   documents); plan 36 gains the coverage-gate cross-ref; ROADMAP and plan
   index updated (this PR).

## Testing

This plan's product is test infrastructure, so verification is
self-referential:

- `npx tsc --noEmit` and `npm run test` / `npm run test:integration` green
  at every commit.
- `npm run test:coverage` green at the end: both scoped projects
  ≥ 70/60/65, every per-file floor met.
- **Prove the gate bites:** delete one test from a floored file on the
  branch, show the coverage run go red, restore. A gate nobody has seen
  fail is a config file, not a guarantee.
- E2E: `e2e/admin-provision.spec.ts` passes in live mode against
  `npm run dev:pglite` — a fresh tenant is provisioned, its manager signs
  in, onboarding renders. No canned user.
- Both-mode `next build` green; the demo bundle is untouched (coverage is
  test-only config, no runtime imports).

## Review checklist

- Every coverage include list contains zero demo/UI paths; `all: true`
  proves no untested file escapes the report.
- No unexplained `v8 ignore` comments in the diff.
- Every named money core is floored; every baseline gap is ≥70 or
  deliberately exempted with a written reason (demo-only, or owned by the
  other project — `staff-core`, `db.ts`).
- Isolation canary + wrong-role 403 confirmed present in every tenant-owned
  integration suite (grep the helper name, don't claim it).
- Coverage run stays inside plan 36's ~5-minute CI budget.
- AGENTS.md §7 documents the gate and the demo exclusion in the same PR
  (AGENTS.md §9.9).

## Exit criteria

1. `npm run test:coverage` green: unit and integration both ≥ 70%
   statements / 60% branches / 65% functions on the scoped includes.
2. Every §7.1 money core has a per-file floor ≥ 80; the baseline gap list
   is closed or exempted with written reasons.
3. `e2e/admin-provision.spec.ts` passes in live mode: admin provisions a
   tenant, the new manager signs in and lands in onboarding.
4. Every tenant-owned integration suite carries the isolation canary and
   one wrong-role 403 case.
5. Plan 36's check-job spec lists the coverage gate (wired when 36 lands;
   the plan file already cross-refs it).
6. AGENTS.md §7 documents the gate and the demo exclusion; ROADMAP and plan
   index reflect plan 37.
