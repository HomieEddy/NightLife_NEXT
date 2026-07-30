# Workstream Prompt — Copy/Paste Template

For ROADMAP Phase 7 (live graduation). Copy the prompt below, replace
`[WS]` and `[WS_NAME]` with the workstream you're implementing (e.g. `WS-1` /
`Tab ledger & financial controls`), then paste it as your first message in a new
Claude Code session.

---

```
I'm implementing [WS] — [WS_NAME] from docs/ROADMAP.md Phase 7.

Before writing any code, do this in order:

1. READ THE GOVERNING DOCS:
   - AGENTS.md (full — it's the law)
   - docs/ROADMAP.md, Phase 7 (find [WS] in the workstream table: scope, plans, stubs to fill, risk — plus the phase rules and exit criteria)
   - The matching docs/plans/NN-*-PLAN.md for this workstream's plan number (it has the detailed design, data model, and test requirements)
   - docs/ARD.md for any AD the workstream touches (AD-3 tenant scoping, AD-5 money, AD-16 audit trail, AD-22 notifications, AD-24 TanStack Query)

2. SURVEY THE EXISTING CODE:
   - Read every live-service file listed in the "Stubs to fill" column
   - Read 2-3 live-service files that ARE already implemented (ordering/live-service.ts, venue/live-service.ts) to absorb the house patterns: how routes are structured, how auth is checked, how errors are returned, how the selector works
   - Read the corresponding mock-service — the mock IS the type contract; the live implementation must `satisfies` it
   - Check prisma/schema.prisma for models relevant to this workstream — many already exist
   - Check src/features/{domain}/query-keys.ts — the UI reads through TanStack Query (AD-24), so know which keys your mutations must invalidate

3. IMPLEMENT using workstreams in this order:
   a. Schema changes first (if any new Prisma models/columns needed, add them and run `npx prisma generate`)
   b. Tests first for invariants — money math, state machines, ledgers, locks (AGENTS.md §7b.3). Write the failing test, then the code.
   c. Core business logic in src/features/{domain}/core.ts (pure functions, state machines, validation)
   d. Route handlers in src/app/api/ (follow the exact pattern of existing routes: isDemoMode gate, requireApiArea auth, sessionToDbContext for venueId, Zod validation at boundary)
   e. Wire the live-service methods (replace `throw new Error("Not yet supported")` with real API calls following the liveFetch/api helper pattern used by sibling services)
   f. Remove the fulfilled TODO comments in the same commit as the code that fulfills them

4. AFTER EACH WORKSTREAM, verify:
   - `npx tsc --noEmit` (must pass — no new type errors)
   - `npx eslint src` (fix what you introduced)
   - `npm run test` and `npm run test:integration`
   - Drive the feature in the preview browser in BOTH modes (don't just claim it works — show it working)

5. COMMIT per slice (not one giant squash):
   - Schema + migration = 1 commit
   - Tests + core logic = 1 commit
   - Route handlers = 1 commit
   - Live-service wiring + TODO removal = 1 commit
   - Each commit must be green on tsc and the test suite

6. RULES THAT MATTER:
   - Every route must check auth via requireApiArea and scope queries by venueId (multi-tenancy is not optional)
   - Every integration suite for a tenant-owned model calls expectTenantIsolation(); every role-gated endpoint gets one wrong-role 403 case
   - Money math: integer cents, server-computed, rounded at the service boundary; formatMoney() + tabular-nums in UI
   - Consequential actions need ConfirmDialog (see AGENTS.md §4.5 for the full policy table)
   - The mock service is NEVER edited to ship live behavior — mocks stay forever as the demo sandbox
   - The selector in src/features/{domain}/services.ts picks mock vs live from NEXT_PUBLIC_APP_MODE; don't touch call sites
   - No direct pushes — don't push, don't amend, don't force anything
   - Test the live code path with `npm run dev:pglite` (PGlite in-process, no Docker needed)

Do NOT start coding until you've completed steps 1-2. State what you found and your implementation plan, then proceed.
```

---

## Workstream Reference

| WS | Scope | Plan(s) | Plan file(s) |
|----|-------|---------|--------------|
| WS-1 | Tab ledger & financial controls | 16 | `docs/plans/16-tab-ledger-adjustments-PLAN.md` |
| WS-2 | Door, guest identity & safety | 17 | `docs/plans/17-door-arrival-guest-identity-PLAN.md` |
| WS-3 | Hospitality completion (reservations, events, promoters) | 13, 14, 08 | `docs/plans/13-embedded-reservations-PLAN.md`, `docs/plans/14-promoters-PLAN.md` |
| WS-4 | Workforce & incentives | 18 | `docs/plans/18-workforce-time-incentives-PLAN.md` |
| WS-5 | Cost, supply & profitability | 19 | `docs/plans/19-cost-supply-profitability-PLAN.md` |
| WS-6 | Role permissions persistence | 15 | `docs/plans/15-floor-roles-security-PLAN.md` |
| WS-7 | Notification residue | 25, 26 | `docs/plans/25-notifications-email-PLAN.md`, `docs/plans/26-notifications-sms-PLAN.md` |
| WS-8 | Schema & type alignment | — | No dedicated plan (incremental fixes) |

Dependency order and the per-workstream stub lists are in `docs/ROADMAP.md`
Phase 7. Branch naming: `feature/ws-N-shortname`.
