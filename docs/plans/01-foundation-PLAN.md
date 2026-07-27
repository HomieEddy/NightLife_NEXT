# 01 — Foundation · PLAN

**Status: complete.**

Goal: the rails every later plan runs on — database, scoped data access, money
convention, test infrastructure, seeds. Ships **zero user-visible change**.

## Reasoning

Every subsequent plan needs the same four things: a Postgres to migrate, a Prisma
client that can't forget tenant scoping, a cents-based money convention, and a test
harness that can prove invariants. Doing them piecemeal inside feature plans is how
projects end up with three half-configured test setups. One boring plan, then
features move fast.

## Design choices

- **Prisma + managed Postgres** per AD-2. Local dev via Docker Compose Postgres
  (checked in) so `npm run dev` needs no cloud account.
- **Scoped client** per AD-3: `getDb(session)` returns a Prisma client extension
  that injects `venueId` into every query on tenant models; `getPlatformDb()`
  (unscoped) importable **only** from `src/server/platform/` — enforced by an
  ESLint `no-restricted-imports` rule, not convention.
- **Cents** per AD-5: schema uses `*Cents Int`; one shared `src/server/money.ts`
  with `toCents/fromCents/splitCents` (port of the receipt page's `evenShares` —
  it becomes the first unit-tested function).
- **Env** per AD-13: `src/lib/env.ts` Zod-validates `DATABASE_URL`, secrets at boot.
- **Dual-mode selector layer** per AD-14: `src/lib/app-mode.ts`
   (`isDemoMode()` from `NEXT_PUBLIC_APP_MODE`; **must be set explicitly** —
   missing or misspelled values fail configuration at boot, per AD-13).
   `src/lib/services/` — one selector file per service exporting the plain name
   (`export const venueService: VenueService = isDemoMode() ? mockVenueService :
   realVenueService`, with `type VenueService = typeof mockVenueService`).
  Until a real implementation exists, the selector exports the mock for both
  modes — so **this plan already migrates every page import** from
  `mock-services/*` to `services/*` (mechanical, zero behavior change), and adds
  the ESLint `no-restricted-imports` rule confining `mock-services/*` to
  selectors, tests and seeds. Later plans then touch only the selector's real
  branch.
- **Seeds**: `prisma/seed.ts` imports the existing `src/lib/mock-data/*` literals
  and inserts them (dollar → cents at the boundary). Mock data stays the single
  source of demo truth (AGENTS.md §9.4).
- **Test infra** per AD-10: Vitest configured with two projects — `unit` (node, no
   DB) and `integration` (PGlite in-process, `prisma migrate deploy` +
   seed-per-suite). Playwright installed with one smoke
   spec (landing page renders) to prove the harness.
   Integration tests use PGlite — zero Docker requirement per §7b.1.
   `src/server/test-pglite.ts` provides the harness.
- **No schema for features yet.** Only the platform-independent primitives:
  `Tenant` (referenced by scoping), `JobRun` (AD-9). Feature tables land with
  their plans — schema-with-its-feature keeps PRs reviewable.

## Implementation strategy

1. Add deps: `prisma @prisma/client zod`, dev: `vitest @vitest/coverage-v8
   testcontainers @playwright/test dotenv-cli`. (Earn-every-dependency note:
   these are the Phase 2 baseline named in the ARD, approved as a set.)
2. `docker-compose.yml` (postgres:17-alpine), `.env.example`, `src/lib/env.ts`.
3. `prisma/schema.prisma` with conventions from DDD §6 + `Tenant`, `JobRun`.
4. `src/server/db.ts` (scoped client + extension), `src/server/money.ts`.
5. ESLint guards: `getPlatformDb` import restriction + `mock-services/*` import
   restriction (AD-14).
5b. `app-mode.ts` + the 16 selector files (mock-only for now) + the repo-wide
   import migration; verify with the preview drive that nothing changed.
6. `prisma/seed.ts` skeleton (tenant "LUXE Noir" only, until plan 03 adds tables).
7. Vitest + Playwright config, `npm run test`, `test:integration`, `test:e2e`.
8. First tests: `money.test.ts` (splitCents sums exactly, INV-style),
   `scoping.integration.test.ts` (two tenants, cross-read fails → proves AD-3).

## Testing

- Unit: money helpers (exact-cent splits incl. remainders, negative guards).
- Integration: scoped-client isolation (the R2 canary that every later suite reuses
  as a helper: `expectTenantIsolation(model)`).
- Meta: CI script order = tsc → eslint → unit → integration → build.

## Review checklist

- Can any code path obtain an unscoped client outside `src/server/platform/`?
- Do seeds round-trip mock-data dollars to cents and back without drift?
- Does a fresh clone go `docker compose up` → `migrate` → `seed` → green suite?

## Exit criteria

Fresh-clone bootstrap documented in README and proven in CI; both canary tests
green; zero UI diffs (`next build` output identical page list).
