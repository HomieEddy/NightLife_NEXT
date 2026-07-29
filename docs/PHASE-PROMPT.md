# Phase Implementation Prompt — Copy/Paste Template

Copy the prompt below, replace `[PHASE_LETTER]` and `[PHASE_NAME]` with the
phase you're implementing (e.g., `A` / `Tab Ledger & Financial Controls`), then
paste it as your first message in a new Claude Code session.

---

```
I'm implementing Phase [PHASE_LETTER] — [PHASE_NAME] from docs/TODO-AUDIT.md.

Before writing any code, do this in order:

1. READ THE GOVERNING DOCS:
   - AGENTS.md (full — it's the law)
   - docs/TODO-AUDIT.md (find Phase [PHASE_LETTER], read every row)
   - docs/ROADMAP.md (find the matching plan number, understand dependencies and exit criteria)
   - The matching docs/plans/NN-*-PLAN.md file for this phase's plan number (it has the detailed design, data model, and test requirements)

2. SURVEY THE EXISTING CODE:
   - Read every file listed in the Phase [PHASE_LETTER] TODO table (the "TODO Location" column gives exact file:line references)
   - Read 2-3 neighboring live-service files that ARE already implemented (e.g., ordering/live-service.ts, venue/live-service.ts) to absorb the house patterns: how routes are structured, how auth is checked, how errors are returned, how the service selector works
   - Read the corresponding mock-service file for the feature you're implementing — the mock IS the type contract; the live implementation must `satisfies` it
   - Check the Prisma schema (prisma/schema.prisma) for existing models relevant to this phase — many already exist

3. IMPLEMENT using workstreams in this order:
   a. Schema changes first (if any new Prisma models/columns needed, add them and run `npx prisma generate`)
   b. Core business logic in src/features/{domain}/core.ts (pure functions, state machines, validation)
   c. Route handlers in src/app/api/ (follow the exact pattern of existing routes: isDemoMode gate, requireApiArea auth, sessionToDbContext for venueId, Zod validation at boundary)
   d. Wire the live-service methods (replace `throw new Error("Not yet supported")` with real API calls following the liveFetch/api helper pattern used by sibling services)
   e. Remove the fulfilled TODO comments in the same commit as the code that fulfills them

4. AFTER EACH WORKSTREAM, verify:
   - `npx tsc --noEmit` (must pass — no new type errors)
   - `npx eslint src` (fix what you introduced)
   - Drive the feature in the preview browser (don't just claim it works — show it working)

5. COMMIT per workstream (not one giant squash):
   - Schema + migration = 1 commit
   - Core logic = 1 commit  
   - Route handlers = 1 commit
   - Live-service wiring + TODO removal = 1 commit
   - Each commit must be green on tsc

6. RULES THAT MATTER:
   - Every route must check auth via requireApiArea and scope queries by venueId (multi-tenancy is not optional)
   - Money math: round to cents at the service boundary (Math.round(x * 100) / 100), use formatMoney() + tabular-nums in UI
   - Consequential actions need ConfirmDialog (see AGENTS.md §4.5 for the full policy table)
   - The mock service is NEVER edited to ship live behavior — mocks stay forever as the demo sandbox
   - The live-service selector in src/features/{domain}/services.ts picks mock vs live based on NEXT_PUBLIC_APP_MODE
   - No direct pushes — don't push, don't amend, don't force anything
   - Test the live code path with `npm run dev:pglite` (PGlite in-process, no Docker needed)

Do NOT start coding until you've completed steps 1-2. State what you found and your implementation plan, then proceed.
```

---

## Phase Reference

| Phase | Plan # | Plan File |
|-------|--------|-----------|
| A — Tab Ledger | 16 | `docs/plans/16-tab-ledger-adjustments-PLAN.md` |
| B — Door/Safety | 17 | `docs/plans/17-door-arrival-guest-identity-PLAN.md` |
| C — Workforce | 18 | `docs/plans/18-workforce-time-incentives-PLAN.md` |
| D — Purchasing | 19 | `docs/plans/19-cost-supply-profitability-PLAN.md` |
| E — Permissions | 15 | `docs/plans/15-floor-roles-security-PLAN.md` |
| F — Notifications | 25, 26 | `docs/plans/25-notifications-email-PLAN.md`, `docs/plans/26-notifications-sms-PLAN.md` |
| G — Schema/Types | — | No dedicated plan (incremental fixes) |
| H — Payments | — | No dedicated plan (Stripe integration) |
