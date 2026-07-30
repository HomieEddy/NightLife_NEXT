<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — how to work on NightLifeNext

NightLifeNext is a nightclub-operations SaaS. Three role areas: `/manager`
(venue ops), `/staff` (floor crew), `/guest` (QR ordering), plus `/admin`
(platform SaaS). The point of this document is process, not trivia: read it
once, then behave like the agent that built this repo.

**First, detect which track you're on** — this repo runs two permanent tracks,
per feature, not per era (ARD AD-14):

- **Demo track (the sandbox):** mock data + in-memory services in
`src/features/{domain}/mock-service.ts`, shipped forever as the public Live Demo. Every new
  feature **starts here**: sketch mock-first, iterate the UX in the preview,
  keep its entry points behind `isDemoMode()`. The "demo track" rules below are
  this track's rules — they never expire, and they are unrelated to the
  numbered *product* phases in `docs/ROADMAP.md`.
- **Live track (the backend):** signals it exists: `prisma/`, `src/app/api/`
  route handlers, an auth library, `*.test.ts`. A feature moves here only by
  **graduating**: a `docs/plans/NN-name-PLAN.md`, a real implementation that
  `satisfies` the mock's type, the selector wired, the demo gate removed —
  see §9 and `docs/ROADMAP.md`. Backend-conditional notes in §5 and §7 apply
  to this track.

Which track is a given task on? New feature or UX change → demo track first.
Implementing/altering persistence, auth, realtime → live track, governed by the
feature's plan. Mocks are never edited to ship live behavior, and live code
never leaks into the demo bundle — the selector layer
(`src/features/{domain}/services.ts`) is the only meeting point.

Everything else — reasoning, planning, quality, review — applies identically
on both tracks.

The spirit here is Karpathy's: **think before you type, keep the diff surgical,
verify by running the thing, and don't decorate your work with ceremony.** The
best code is the code you didn't write; the second best is code that looks like
it was always there.

---

## 1. Reasoning — before any code

1. **Survey before you plan.** `wc -l` the relevant pages, read the 2–4 files
   you'll touch *in full*, and read one neighboring file you won't touch to
   absorb the house style. Most "new features" here are thin pages waiting to be
   fleshed out — greenfield instincts are usually wrong.
2. **Find the existing seam.** Before inventing anything, grep for prior art:
   the pattern you need almost certainly exists (a dialog on the zones page, a
   filter on the tables page, a `?zone=` param already being read). Generalize
   the existing instance; don't build a parallel one.
3. **Check `docs/superpowers/specs/` first.** Features may already have a design
   spec committed. If one exists, it is the plan — implement it, including its
   corrections and out-of-scope notes.
4. **State your interpretation, then act.** When a request is ambiguous
   ("more analytics"), pick the reading that fits the domain (a nightclub:
   nights peak Fri/Sat, runners deliver bottles) and say what you chose in one
   sentence. Do not stall on questions you can answer from the code.
5. **Scale the thinking to the risk.** A label rename needs none. Anything
   touching money math (fees, totals), state machines (order status), or shared
   types deserves a minute of "what breaks downstream?" — then grep every usage
   before changing the type.

## 2. Planning

1. **Decompose into workstreams, order by dependency.** Foundation first: data
   model → mock service → page. Zones before tables, tables before floor map,
   analytics data before analytics UI.
2. **Track multi-part work with the task list** (one task per workstream, mark
   `in_progress`/`completed` as you go). It's for the human reading along, not
   for you.
3. **Checkpoint cheaply and often.** Run `npx tsc --noEmit` after each
   workstream, not at the end of five. A type error caught early is a one-line
   fix; caught late it's archaeology.
4. **Don't gold-plate a prototype.** YAGNI aggressively: no state libraries.
   Dependencies earned their place — react-hook-form replaced hand-rolled
   form state across 25 forms, Recharts replaced `MockChart`, dnd-kit
   replaced raw pointer events on the floor map, TanStack Virtual replaced
   page-based pagination, and react-day-picker replaced native date inputs
   (plan 30). Each was swapped in only after the hand-rolled version proved
   insufficient. Earn every dependency.

## 3. Architecture — the load-bearing walls

The repo has exactly one architectural idea. Respect it:

```
src/features/{domain}/        ← Feature folders aligned with DDD bounded contexts
  services.ts                 ← selector: picks mock vs live
  mock-service.ts             ← in-memory demo implementation
  mock-data.ts                ← seed data (plain literals, French-touched)
  live-service.ts             ← live (DB-backed) implementation
  core.ts                     ← business logic, invariants, state machines
  schemas.ts                  ← Zod validation at the boundary
  types.ts                    ← domain-specific types
src/lib/types.ts              ← the central type contract (re-exports feature types)
src/app/**/page.tsx           ← client pages that only talk to feature services
src/components/shared/*.tsx   ← cross-role primitives (cards, badges, chips, dialogs)
src/components/manager/*.tsx ← role-specific composites when a page gets fat
```

Rules that follow from it:

1. **Never bypass the service layer.** Pages import `mockXService`, never
   `mock-data` directly (one legacy exception in the guest cart is being paid
   down, not extended). Every service method: `await delay(...)` to exercise
   loading states, `clone(...)` on the way out so callers can't mutate the store.
2. **Extend `types.ts` first**, service second, UI last. Annotate the future:
   `// TODO(backend): becomes an append-only stock_movements ledger table.`
   These comments are the real spec for the eventual API — write them like you
   mean them.
3. **Business math lives in the feature folder or `src/lib/`, never in
   components.** Fees are computed by `src/features/ordering/fees.ts` and
   consumed by both the guest cart and the orders service — one formula, two
   callers. If a second caller for any calculation appears, extract it the same
   way.
4. **Cross-page navigation goes through `src/features/shared/entity-links.ts` +
   `EntityChip`.**
   URLs live in one place. Target pages own reading their params
   (`useSearchParams` inside a `Suspense` boundary — always, or the build breaks).
5. **State is module-level `let` inside services** — it resets on full page
   reload and on HMR. This is a feature (fresh demo every visit) and a trap
   (don't "verify persistence" across a hard navigation; use client-side nav).
6. **Demo-persistent flags** (like first-run onboarding) go in `localStorage`
   via a tiny helper in `src/lib/`, never sprinkled inline.
7. **Client server-state is TanStack Query's job (ARD AD-24).** Reads are
   `useQuery`, writes are `useMutation` + `invalidateQueries`. Keys come from
   the domain's `query-keys.ts` builder — never an inline array literal at a
   call site. Query sits *above* the selector: query functions call
   `xService.*` from `services.ts`, so demo and live are unchanged. A page that
   fetches in a `useEffect` is a pattern break.

## 4. Code quality

1. **Match the neighborhood.** Before writing a page, mimic the canonical one:
   `"use client"` → `useQuery` for reads → `useMutation` + `invalidateQueries`
   for writes → handlers with `toast` feedback → skeleton (`isPending`) /
   empty-state / list render. Forms are react-hook-form + Zod, never hand-rolled
   state. Dialogs: `openCreate`/`openEdit`, validation via the resolver,
   `saving` spinner. If your page doesn't look like `staff/page.tsx` grew a
   sibling, rewrite it.
2. **Comment constraints, not narration.** Good: `// won/lost are exits, not
   steps`, `// Nightclub week: render Thursday→Sunday first`. Bad: `// map over
   the zones`. Density in this repo is low; keep it that way.
3. **No raw emoji, no raw hex colors.** Icons come from `lucide-react` or
   `BottleIcon`; colors are Tailwind tokens through maps like `ZONE_COLORS` /
   `ZONE_SWATCH` in `src/features/shared/zone-colors.ts`.
4. **Money and counts:** `formatMoney()` + `tabular-nums`, always. Round to
   cents at the service boundary (`Math.round(x * 100) / 100`), not in JSX.
 5. **Consequential actions use `ConfirmDialog` or undo toast by policy (plan 20).**
    **No destructive, audited, or irreversible action fires on a single click — every
    one requires a modal confirmation explaining what will happen and why.** A
    "Resolve" button, a "Record" button, or an "Override" toggle that fires
    instantly is a bug. The rule of thumb, stated once so future features don't
    relitigate it: **if the action can be silently undone with no ledger entry, use
    undo; if undoing it would itself be a recorded business event, confirm it.**

    | Pattern | Applies to |
    |---|---|
    | **Optimistic + 5s undo toast** | order status transitions, claim/release, table status toggle, help acknowledge, shift toggle, waitlist reorder |
    | **Keep `ConfirmDialog`** | anything money-touching (comps, voids, discounts, cash-out close, tip distribution), deletes, cancellations, ban/refusal, incident submit, incident resolve, incident record-reported, publish schedule, plan changes, last call, stocktake commit, emergency evacuation/resume, capacity override, certification revocation, guest ban |

    ConfirmDialog: wrap the trigger, write a title that names the object
    (`Set VIP-01 to reserved?`) and a description that states the consequence.
    Reversible-and-free actions (search, copy link, tab switch) stay one-click.
6. **Functional state updates for rapid-fire controls.** `setX(prev => ...)`
   for steppers and counters — render-closure reads drop clicks. (This bug
   shipped once, in the bulk-restock stepper. Once.)
 7. **Accessibility is not optional chrome:** `aria-label` on icon-only buttons,
    `Label htmlFor` on inputs, keyboard-reachable everything.
 8. **Every action needs a UI trigger.** A service method + a permission row +
    a `TODO(backend)` is not a feature — it's three files of dead code. Any new
    `StaffAction` must ship with a button, switch, form, or confirm dialog on the
    role's primary page that calls it. The safety features (plans 16-17) shipped
    with service methods and permissions but no UI to trigger them — five gaps
    caught at review; this rule exists so it never happens again. Count the
    touchpoints: one permission → one service method → one UI trigger, minimum.

## 5. Verification — evidence before assertions

Claiming "done" requires having *watched it work*. The ladder, cheapest first
(on the live track the test suite runs between steps 2 and 3, and API-level
checks — hit the route handler with real payloads, inspect the DB row — come
before trusting the UI):

1. `npx tsc --noEmit` — after every workstream. Non-negotiable.
2. `npx eslint src` — fix what you introduced; the repo's pre-existing
   `set-state-in-effect` pattern warnings are a known convention, leave them.
3. **Drive the feature in the preview browser** (`preview_*` tools):
   - Prefer `preview_snapshot` / `preview_eval` (text assertions) over
     screenshots; screenshot only to judge layout.
   - Exercise the *flow*, not the render: create the zone, place the order,
     run the report, drag the table. Check `preview_console_logs` for errors
     after.
   - Beware two eval traps: reading the DOM in the same eval that clicked
     (stale before React re-renders — re-read in a second call), and
     `innerText` being CSS-uppercased (`Best night` reads as `BEST NIGHT`).
   - Full-page `location.href` navigation resets mock state; use in-app links
     when testing cross-page state.
4. `npx next build` — before declaring a batch finished. Static generation
   catches the `useSearchParams`-without-`Suspense` class of error that dev
   mode forgives.
5. **Report honestly.** If a check failed, say so with the output. If you
   skipped a step, say that. "Verified: created zone 'Rooftop', card appeared"
   beats "should work now."

## 6. Code review — of others' work and your own

When reviewing (or before finishing your own diff), hunt in this order:

1. **Correctness:** money math (each fee rounded to cents? flat fee on empty
   cart?), filter logic (does "active" exclude cancelled?), state-machine
   transitions, stale-closure bugs in event handlers.
2. **Contract drift:** did a `types.ts` change orphan a mock-data literal or a
   consumer page? Grep the field name across `src/` — the compiler catches
   most, but not `Record<string, ...>` lookups.
3. **Pattern breaks:** a page fetching `mock-data` directly, a dialog without
   confirmation on a destructive path, a hardcoded string that should read
   live state (venue name was hardcoded on the dashboard once — it burned us).
4. **Altitude:** could this 60-line block be the existing shared component with
   two props? Would deleting the abstraction make it simpler? Prefer the diff
   that removes code.
5. One finding = location + problem + concrete fix. No essays, no praise
   sandwiches, no "consider possibly maybe."

## 7. Testing philosophy

**On the demo track:** there is no UI test suite, deliberately — the mock
services *are* the fixtures and the preview browser is the harness. Unit tests
exist where money/logic purity justifies them (`src/lib/*.test.ts`,
`src/features/*/*.test.ts`, the mock-service math), not for rendering.

- **Behavioral verification replaces unit tests**: every feature must be
  driven end-to-end in the preview before it's "done" (see §5).
- Keep logic **testable anyway**: pure functions (`ordering/fees.ts`,
  `shared/entity-links.ts`, the analytics generator) take inputs and return
  outputs — these become the first test files without refactoring.
- Deterministic beats random: mock generators seed from stable hashes
  (see `analytics-service.ts`) so the same date range always renders the same
  chart. Never `Math.random()` in anything an assertion might read —
  `uid()` for identity is the sanctioned exception.

**On the live track:** the suite exists and grows with every route handler.
Priorities, highest value first:

1. **Money math and state machines get unit tests before anything else** —
   `fees.ts`, order-total computation, order/session status transitions,
   inventory ledger balancing (`inventory === Σ movements.delta`). These are
   the functions where a silent bug costs real money.
2. **Route handlers get integration tests** against a real in-process database
   (PGlite via `src/features/shared/test-pglite.ts`) — request in, DB rows + response out.
   No Docker or external Postgres needed. Test the authorization boundary explicitly:
   a staff token must not reach manager endpoints; tenant A must never read tenant B's rows.
3. **A handful of end-to-end flows** (Playwright): guest scan→order→delivery,
   manager fee change→guest cart reflects it, admin provision→manager
   onboarding. These mirror the manual preview flows in §5 — automate the
   ones this file already tells you to click through.
4. The old mock services don't die; they become **seed scripts and test
   fixtures**. Their data shapes are already realistic — reuse, don't rewrite.
5. Don't chase coverage numbers. A test earns its place by failing when a
   plausible mistake is made.

### 7b. Testing strategy — explicit mechanics

The philosophy above decides *what deserves tests*; these rules decide *how you
write and run them*. Per-feature test lists live in `docs/plans/*-PLAN.md` — a
feature's plan names its required tests; don't invent a different set silently.

1. **Harness:** Vitest, two projects — `unit` (node, no I/O) and `integration`
   (route handlers against real Postgres via PGlite in-process database, no Docker needed).
   Playwright for the E2E flows named in §7.3 and the plans. Commands: `npm run test`,
   `test:integration`, `test:e2e`.
2. **Layout & naming:** tests live next to the code they test —
   `src/features/ordering/fees.ts` → `src/features/ordering/fees.test.ts`;
   `*.integration.test.ts` for DB-backed suites; `e2e/*.spec.ts` for Playwright.
   One behavior per test; the name states the rule, not the method:
   `("rejects a claim when another staff already holds the order")`, not
   `("claimOrder works")`.
3. **Test-first is mandatory for invariants.** Money math, state machines,
   ledgers, locks (the DDD `INV-*` list): write the failing test, then the code.
   For everything else, tests land in the same commit as the code — never a
   later "add tests" commit.
4. **Fixtures come from mock data.** Seed suites from
   `src/features/{domain}/mock-data.ts` via shared helpers; if a test needs a
   shape mock data lacks, extend mock data (it feeds the demo too) rather than
   inventing a parallel fixture.
5. **Determinism is non-negotiable:** fake timers for anything time-based
   (SLA ages, ETAs, night boundaries), fixed seeds for generated data, no
   `Math.random()`/`Date.now()` in assertions. A test that flakes gets fixed or
   deleted the day it flakes — never retried into submission.
6. **Isolation canaries:** every integration suite for a tenant-owned model calls
   the shared `expectTenantIsolation()` helper, and role-gated endpoints get one
   wrong-role 403 case. These are cheap and they are the product's security tests.
7. **What not to test:** rendering that TypeScript + the preview drive already
   cover, third-party internals (Stripe/Prisma), styling. UI behavior is
   Playwright's job only for the flows the plans name — everything else stays
   manual per §5.
8. **Where tests run in the ladder (§5):** unit+integration run after eslint and
   before the preview drive; E2E runs before `next build` on migration PRs.
   A red suite blocks the commit — no "will fix in the next one".

## 8. Communication

1. **Lead with the outcome**, then the supporting detail. First sentence =
   what happened.
2. Narrate direction changes and load-bearing discoveries mid-work; skip
   play-by-play.
3. Name limitations unprompted: "in-memory state resets on reload", "the
   wizard's zone config isn't applied to the single mock venue — that's the
   backend seam". A prototype's honesty is its documentation.
4. Version control mechanics — commit cadence, message format, what never to
   do — live in §10.

## 9. Product strategy & graduation playbook

**The master roadmap is `docs/ROADMAP.md`** (re-aligned 2026-07-30). It
organises all work into nine phases: Foundation → Core Ops → Business Logic
Completion → Automation & Intelligence → Mobile (PWA + Push) → Foundation
Modernization → **Live Graduation to MVP** → Production Readiness → CI/CD.

**Where we are:** Phases 1–6 are done. The product is feature-complete *on the
demo track*; roughly half the surface still throws `"Not yet supported"` in the
live build. **Phase 7 closes that gap** and is the only thing between here and
MVP. Read Phase 7's workstream table (WS-1…WS-8) before picking up backend work;
`docs/PHASE-PROMPT.md` is the per-workstream kickoff template.

**Strategy: Business Logic First.** Operational completeness comes before CI/CD,
deployment automation, and production hardening. The PWA is the primary staff
delivery target; push notifications are a first-class feature, not an
afterthought.

**The architecture is governed by `docs/ARD.md`** (PRD/ARD/DDD + per-feature
plans) — where this section and docs/ disagree, docs/ wins and this file gets
fixed.

The prototype was built so the backend can land **service by service, not big
bang**. The whole design bet is the service boundary; cash it in like this.

1. **The service interface is the contract — and the mocks never die.** The
   mock-powered Live Demo is a permanent product surface (ARD AD-14): every
   visitor gets an isolated, self-resetting sandbox. So the migration does NOT
   replace mock bodies. Instead: the mock defines the type
   (`type XService = typeof mockXService`), the real implementation is declared
   `satisfies XService`, and pages import the plain name from a
   `src/features/{domain}/services.ts` selector that picks mock vs real from
   `NEXT_PUBLIC_APP_MODE` (demo/live builds). If you find yourself editing 15
   pages to ship one endpoint — or editing a mock to ship a real feature —
   you're doing it wrong. No `mockXService → xService` renames, ever.
2. **`TODO(backend)` comments are the backlog.** Grep them
   (`grep -rn "TODO(backend)" src/`) before designing anything — they record
   decisions made with full context: which tables are append-only ledgers,
   where transactions and row locks are needed, what becomes a signed token,
   which flows send email. Delete each comment in the same commit that
   fulfills it; a stale TODO is a lie.
3. **`types.ts` seeds the schema, it doesn't survive as one.** Mirror it into
   Prisma models / DTOs, then make `types.ts` derive from (or re-export) the
   generated types so there is exactly one source of truth. Watch the known
   denormalizations — they were UI conveniences, not schema: `itemName` on
   `StockMovement`, `tableCode`/`zoneName` on `Order`, `tableCount` on `Zone`.
   Decide per-field: real column, join, or computed.
4. **Migrate in dependency order, riskiest-cheapest first:**
   venue/zones/tables (pure CRUD, no math) → menu/inventory (ledger semantics)
   → orders + fees (transactions, money — write the tests *first* here) →
   sessions/help/chat (realtime — plan 07 replaced `setInterval` polling with
   SSE via `useLiveEvents`) → analytics/reports (SQL aggregations replace the seeded
   generator) → admin/billing (multi-tenant provisioning, Stripe).
5. **Multi-tenancy is not optional.** Every mock row already carries `venueId`;
   every real query must scope by tenant, enforced centrally (middleware/RLS),
   not per-handler by convention. The `/admin` area operates *across* tenants —
   that's the one deliberate exception, behind a platform role.
6. **Auth replaces simulations — in the live build.** `CURRENT_STAFF_ID`, the
   hardcoded manager persona, the "Simulate host approval" button, and the
   localStorage onboarding gate are stand-ins for sessions and roles
   (manager/host/bartender/runner, guest QR tokens, platform admin). Gate each
   simulation behind `isDemoMode()` in the same PR that ships its real
   counterpart (AD-14) — the demo keeps its fast-forwards, live paths never
   see them, and no code path lets both answer the same question in the same
   build.
7. **Server/client split:** pages here are all `"use client"` because mock
   state lives in the browser. As services become real, prefer moving reads
   into server components / route handlers and keep client components for
   interactivity. Don't do this speculatively — do it per page as its service
   migrates.
8. **What must not regress:** the UX invariants are phase-independent —
   confirmation dialogs on consequential actions, loading skeletons (real
   latency replaces `delay()`), empty states, toast feedback, entity
   cross-links, deterministic money display. The prototype is the spec for how
   the product *feels*; the backend must be invisible to a demo viewer.
9. **Update this file as you go.** When a phase-1 note stops being true
   (e.g. "state resets on reload"), edit it in the same PR. An AGENTS.md that
   describes the previous architecture is worse than none.
10. **The playbook never finishes — it becomes the graduation ritual.** New
    features are born on the demo track (mock data → mock service → UI,
    iterated in the preview, entry points behind `isDemoMode()`) and only
    graduate to live once the UX is settled: write the next
    `docs/plans/NN-featurename-PLAN.md` (same template), implement the real
    branch `satisfies` the mock's type, wire the selector, drop the demo gate
    — one PR per the roadmap's definition of done. Sketching costs no backend
    work; features killed in the sandbox cost nothing at all.
11. **Hosting topology (ARD AD-15):** the demo build deploys to Vercel (free,
    stateless, CDN-cached). Staging and production deploy to OVHcloud VPS
    (Beauharnois, QC) via Coolify (git-push deploys, same infrastructure for
    both). Quebec hosting satisfies PIPEDA + Law 25 data-residency requirements.
    Never test live features against Vercel infrastructure — staging must be
    prod-identical.

## 10. Version control

The repo's history is its second documentation. These rules are how it stays
readable; they codify how this repo has actually been built.

1. **Commit cadence = one verified checkpoint.** During feature work, commit
   each workstream the moment its slice of the §5 ladder is green — typically
   types → service → UI land as two or three commits, not one squash and not
   ten fragments. If you can't name the commit in one line, it's two commits.
2. **One concern per commit.** Never mix a refactor with a behavior change, or
   two features, or "and also fixed a typo elsewhere". Drive-by fixes get their
   own commit before or after. Schema migrations ship in the same commit as the
   code that needs them, never separately.
3. **Subject:** imperative, ≤ 50 chars, no trailing period, says what the
   commit does to the tree — `Add order claim/release so runners don't
   duplicate work`, not `Added claiming` or `WIP`.
4. **Body (when the subject can't carry it):** the *why* and the non-obvious —
   design decisions, behavior changes, verification notes, honest caveats
   ("staff-side badge not click-tested this session because …"). Wrap ~72 cols.
   A reviewer reading only `git log` should understand the project's story.
5. **Never commit red.** `npx tsc --noEmit` green is the floor for every
   commit; the relevant tests green once the suite exists (§7b.8). A commit is
   a checkpoint someone can `git checkout` and run.
6. **What's forbidden without an explicit ask:** `push`, `commit --amend`,
   `rebase`, `reset --hard`, force-anything, tags, new branches, touching
   `.git/` config, and skipping hooks (`--no-verify`). History rewriting is the
   user's call, always.
7. **Same-commit coupling rules** (from §9): a `TODO(backend)` dies in the
   commit that fulfils it; a simulation dies in the PR that ships its real
   counterpart; AGENTS.md/docs edits ride with the change that made them stale
   (§9.9); the plan file updates in the same PR that departs from it
   (ROADMAP definition-of-done).
8. **Branching strategy** — two permanent branches, short-lived work branches,
   tied to the hosting topology (AD-15, `docs/HOSTING.md`):

   **Permanent branches:**

   | Branch | Deploys to | Accepts merges from |
   |---|---|---|
   | `dev` | OVHcloud staging (auto-deploy) | Feature, fix, refactor, chore branches |
   | `master` | OVHcloud production + Vercel demo (auto-deploy) | `dev` only (release PRs) |

   **Work branches** — branch from `dev`, merge back to `dev` via PR:

   | Prefix | When | Example |
   |---|---|---|
   | `feature/` | New functionality (plan-driven or standalone) | `feature/12-waitlist` |
   | `fix/` | Bug fixes | `fix/cart-rounding-error` |
   | `refactor/` | Code quality, no behavior change | `refactor/extract-receipt-math` |
   | `chore/` | Docs, deps, CI, config | `chore/coolify-deploy-config` |

   Plan-numbered features keep the `NN-` prefix (`feature/12-waitlist`);
   non-plan work uses a descriptive slug. Branches are deleted after merge
   (locally and remote).

   **Flow:**

   ```
   feature/12-waitlist ──PR──► dev (staging) ──PR──► master (prod + demo)
   fix/cart-rounding   ──PR──►     │                     │
   refactor/receipts   ──PR──►     │                     │
                                   │                     │
                            auto-deploys to         auto-deploys to
                            OVHcloud staging        OVHcloud prod +
                                                    Vercel demo
   ```

   **Release cadence:** when `dev` is stable and QA'd on staging, open a PR
   from `dev` → `master`. The PR description is the release summary (what
   shipped, what was tested). Merge triggers production and demo deploys.

   **Hotfixes** (production-critical bugs that can't wait for the next
   release): branch `hotfix/description` from `master`, fix, PR to `master`.
   After merge, immediately cherry-pick or merge `master` back into `dev` so
   the branches don't diverge. Hotfixes are rare — most fixes go through the
   normal `dev` flow.

   **Integration branches** (the one sanctioned exception to short-lived work
   branches): a multi-week phase whose parts share a seam may run on a single
   integration branch — workstream branches PR into it, and one release PR
   closes the phase into `dev`. Currently in use: `feature/live-graduation`
   for ROADMAP Phase 7 (see its "Phase 7 runs on an integration branch"
   section). Don't reach for this pattern for ordinary feature work; the cost
   is that staging sees nothing until the phase closes.

   **Rules:**
   - No direct pushes to `dev` or `master` — always via PR.
   - Every PR to `dev` must pass `tsc`, eslint, and the test suite.
   - Every PR to `master` (release) must have been validated on staging.
   - Feature branches are short-lived: days, not weeks. Long-lived branches
     accumulate merge pain.
   - Rebase feature branches onto `dev` before opening the PR if they've
     diverged significantly. Never rebase `dev` or `master`.
9. **Hygiene:** never commit secrets, `.env*` (except `.env.example`),
   generated artifacts, or `node_modules`; extend `.gitignore` in the same
   commit that introduces a new artifact type. Before any commit: `git status`
   — if a file you didn't touch shows up modified, stop and find out why
   (per the "someone else edited it" rule, don't revert what you don't own).

---

## Appendix: repo gotchas (learned the hard way)

Most of these are phase-1 mechanics; per §9.9, prune each one when the backend
makes it obsolete.

- `NEXT_PUBLIC_APP_MODE` is required and accepts only `demo` or `live`; missing
  or misspelled values fail configuration. Demo resource guards reject DB/auth/
  HTTP/SSE access, while live selectors reject mock execution. Tests set live
  mode explicitly; browser/build verification must exercise both modes.
- Venue timezone, opening hours and `nightStartHour`/`nightEndHour` are persisted
  live settings. Every business-night consumer receives that venue config — no
  Toronto/18:00 fallback is allowed in server analytics.
- Live staff identity is `User` + venue `Member` + `StaffProfile`; exact floor
  role lives on the profile, while the member role is coarse access. Claims,
  chat and shows derive attribution from the authenticated profile, never JSON.
- Each build owns its home: the **demo** build's `/` redirects to `/demo` (the
  tour) and `/pricing` 404s; the **live** build's `/` is the marketing landing,
  `/demo` 404s (the tour is demo-only), and `/lead`, `/admin` and
  `/manager/subscription` are real live surfaces (plan 10). The live landing's
  "Request a demo" CTAs cross-link to the demo app's `/lead`
  (`NEXT_PUBLIC_DEMO_URL`). Don't add a link without checking which build
  renders it.
- Login routes by role: `signIn()` resolves the authenticated `AuthUser` and the
  login page pushes `ROLE_HOME[user.role]`. Live roles derive from the active
  org member (owner/admin → manager, member → staff, `isPlatformAdmin` → admin)
  — Better Auth org roles are never "manager", don't compare against it.
- Direct-URL guards (live mode only): `src/proxy.ts` requires a session cookie
  for `/manager|/staff|/admin` and the `nln-guest-session` cookie for `/guest/*`
  (missing → back to `/` to rescan); the manager/staff **layouts are server
  components** calling `requireArea()` so a wrong-role paste bounces to
  `/login?error=forbidden`. Their client chrome lives in
  `ManagerShell`/`StaffShell` (`src/components/{manager,staff}/`). Demo mode
  keeps the client-side `RequireAuth` gate only.
- Shells read the venue name via `venueService.getVenue()` — never hardcode a
  venue string in layout chrome; demo shows the seeded venue, live the tenant's.

- Before trusting that a feature is complete, count the touchpoints: a new
  `StaffAction` needs exactly one permission row, one service method, and one UI
  trigger on a role's page. Finding a service method with no UI to invoke it is
  the same class of gap as the safety features that shipped half-finished — this
  appendix entry is the tripwire.

- `useSearchParams` **must** sit under `<Suspense>` — wrap the page content in
  a `*Content` component; the default export renders the boundary.
- Radix `Switch`/`Button` work as `ConfirmDialog` triggers via `asChild` —
  pass the `Switch` **without** `onCheckedChange` (the dialog's confirm does
  the work), or it fires before confirmation.
- shadcn `Card` spreads props — `id={...}` on it works (used by the
  `?highlight=` scroll-and-ring pattern in `use-highlight.ts`).
- Print styles: manager chrome is `print:hidden`; the QR sheet is
  `hidden print:block`. Test with the print dialog, not by guessing.
- Recharts renders every label by default — aggregate to weekly buckets past
  ~21 data points (`aggregateWeekly`) to keep chart axes legible.
- The dev server module graph re-instantiates service state on HMR of any file
  in the import chain. If a manual test spans an edit, re-run the test.
- All graduated services (plans 03–10) persist across reload **in live mode
  only** — real Postgres behind each selector's live branch. Demo mode still
  resets on reload; that's the permanent sandbox behavior (AD-14), not a bug.
  Local live testing: `npm run dev:pglite` (PGlite in-process, fastest),
  the compose stack in `compose.yaml` (real Postgres 17 + both
  live/demo apps), or connect to real Postgres at `DATABASE_URL` for external DBs.
- Guest flow entry: **demo mode** — `/g/demo-table` → join → "Simulate host
  approval" (prototype control, demo-only) → menu. **Live mode** — QR URL is
  `/g/<tableId>.<sig>` (signed token); guest joins via API, sets httpOnly
  cookie, receives real host approval via SSE (`useLiveEvents`). Simulate buttons
  are gated behind `isDemoMode()` and never render in the live build.
  `QR_TOKEN_SECRET` env var is required in live mode (distinct from
  `AUTH_SECRET`). A table with an active confirmed reservation is gated behind
  its 6-digit reservation PIN (plan 13 — demo track only until it graduates).
  The manager area gates on first run: clear
  `localStorage["nlx-manager-onboarded"]` to see onboarding.
- Realtime (plan 07): **demo mode** uses fallback polling only (no SSE server).
  **Live mode** uses SSE via `useLiveEvents` → `/api/live/{manager,staff,guest}`
  backed by Postgres `LISTEN/NOTIFY`. All pages use `useLiveEvents` — zero
  `setInterval(refresh` patterns remain. Floor coordination (broadcasts, last
  call, show lock, chat) lives in `src/features/realtime/floor-core.ts` with
  domain events published via `src/features/realtime/events.ts`.
