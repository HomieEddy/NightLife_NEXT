# 09b — V1 Operational Closure · PLAN

Goal: close the live-mode seams left by plans 02–09 so staff identity is real,
guest sessions own table occupancy through external settlement, venue-local time
rules are configurable, category-owned washer/presentation choices price correctly,
demo simulations cannot leak into live UI, and failed operations recover honestly.

Preconditions: plans 02 (accounts/roles), 03 (venue/tables/shifts), 04
(menu/inventory/packages), 05 (order pricing/transaction), 06 (guest sessions),
07 (events), and 09 (business-night consumers). Plan 10 remains next and
exclusively owns platform leads, provisioning, Stripe, subscription limits and
tenant suspension.

Implementation status: complete on `feature/09b-v1-operational-closure` (2026-07-14).
The permanent demo and live builds, unit/integration suites, and mode-specific
Playwright smoke flows are the acceptance evidence for this checkpoint.

## Reasoning

The backend migration is operationally broad but not yet closed: the live staff
service still delegates identity CRUD to browser mocks; session transitions do
not move their table; the analytics boundary is fixed to one club schedule; and
many mutation handlers assume the network always succeeds. Demo fast-forwards are
partly gated today, but demo-table links and mock imports still sit in shared UI,
so hiding one button is not yet a trustworthy live/demo boundary. These are not
new features. They are corrections to plans 02, 03, 06 and 09, grouped before
billing because plan 10's graduation flow must provision a venue that can
actually run a night without seeded personas or misleading success states.

The one product addition follows the permanent lifecycle rather than skipping to
live: category/package add-ons are completed and preview-driven against mock data
first, kept demo-only while unsettled, then graduated through the same service
contract with money/inventory tests written before backend implementation.

## Design choices

- **Staff identity finishes plan 02**: `User` + venue-scoped `Member` +
  `StaffProfile` remain the only active-staff source. Better Auth's
  `Member.role` stays the coarse access role (`owner | admin | member`), while
  `StaffProfile.role` stores the exact `manager | host | bartender | runner`
  floor role; `User.banned` maps to suspended; pending `Invitation` rows map to
  invited. Invitation rows gain only the draft fields needed by the current
  dialog (name, phone, exact floor role, assigned zone ids) so accepting one can
  create the profile and coarse membership without a parallel roster table.
- **One staff service, two permanent implementations**: add venue-scoped staff
  route handlers/core functions for list/current/update/shift/suspend/remove and
  wire `liveStaffService` to them. Creation/resend continue through Better Auth's
  invitation mechanism. `StaffShift.staffId` becomes a real `User` FK; removing
  a member also removes their venue shifts. Mock behavior and call-site shapes
  stay intact (R1/AD-14).
- **Authenticated attribution**: current-staff reads resolve the signed-in user,
  membership and profile; clients no longer supply authoritative author/claim
  identity. Order claims, show actions and chat writes take staff id/name/role
  from the server session. Payload identity fields may remain in the mock
  contract but are ignored by live handlers.
- **Session ↔ table is one transaction**: auto-approval or staff approval locks
  the table, rejects another active session, and changes an open/reserved table
  to `occupied`. Denial leaves the table unchanged. Closing locks the same table,
  records `settledExternallyAt` + `settlementMethod` (`terminal | cash | house`),
  then returns it to `reserved` when a confirmed reservation still holds it,
  otherwise `open`. Session status, table status and domain event commit or roll
  back together (INV-S4); closing still rejects in-flight orders (INV-S2).
- **External settlement, not guest payments**: the staff closure dialog requires
  a settlement method and says exactly what happens. No amount capture, card
  storage, Stripe Connect or receipt-email work lands here — guest payment
  processing remains Phase 3 and plan 10's Stripe remains SaaS-only.
- **Venue-local time is explicit config**: `Venue` gains integer
  `nightStartHour`/`nightEndHour` defaults of 18/10; the existing `timezone` and
  `openingHours` fields become editable in settings. Opening slots use native
  time inputs; an absent day means closed. `night.ts` accepts one required config
  object so the compiler exposes every dashboard/rollup caller still assuming
  constants. Timezone validation uses `Intl.DateTimeFormat`, not a dependency.
- **Category CRUD owns bottle add-on presets**: `MenuCategory` gains
  `modifierGroups`; every item inherits the groups of its category, eliminating
  today's duplicated item-level arrays. The manager menu gets create/edit/
  activate/reorder/delete category UI plus a preset editor. Deletion is rejected
  while items reference the category. `BottlePackage` has its own
  `modifierGroups` because packages are not category members; the existing
  package editor owns those choices without inventing a reusable-preset library.
- **One quantity-capable add-on shape**: groups have `kind: washer |
  presentation`, `required`, and `maxSelections` (distinct options); options have
  a per-unit `priceDelta`, `maxQuantity`, and optional `inventoryItemId`.
  Washer options reference stocked menu items when inventory should decrement;
  presentation options such as an LED board, sparklers or light show normally
  cap at one and need no inventory item. `OrderItemModifier` snapshots kind,
  group/option names, per-unit price and selected quantity so past orders remain
  immune to later preset edits.
- **Add-on quantity is independent of line quantity (INV-O5)**:
  `lineSubtotalCents = baseUnitCents × lineQuantity +
  Σ(addOnUnitCents × addOnQuantity)`. Two $200 bottles plus three $6 washers are
  $418, never $436. Existing happy-hour/promotion eligibility continues to apply
  to the full category line (base + add-ons); fees apply afterward unchanged.
  Washer inventory draw-down is also independent: three selected washer units
  decrement three units, regardless of bottle/package quantity.
- **Guest choice and fulfillment**: the item dialog renders washer quantity
  steppers and single-quantity presentation services, enforcing required groups,
  distinct-selection limits and per-option maxima. Package cards open the same
  chooser instead of adding immediately. Cart, checkout, guest tracking, receipt,
  staff cards and manager orders render `3× Red Bull` / `1× LED board` with the
  exact add-on subtotal. The show queue keys off `kind: presentation`, replacing
  brittle matching of the display label `Presentation`.
- **Server owns choices and prices**: live order requests send only group id,
  option id and quantity. Inside the order transaction the server reloads the
  category/package preset, rejects unknown/disabled/out-of-limit choices and
  unavailable washer inventory, resolves price/name/kind snapshots, and locks +
  decrements referenced washer items alongside bottle/package inventory. Client
  names/prices are never trusted; any order failure rolls back every draw-down.
- **Demo UI is an isolated product surface**: move simulation controls and their
  handlers into `src/components/demo/` leaf components selected at build time.
  Demo shells show one compact “Live Demo · sandbox resets” banner; helpers stay
  clearly labeled and keep using mock services. Live mode renders no disabled
  facsimile: simulate-host-approval, order-progress, closure-approval, demo QR
  shortcuts, persona login chips and the local admin password gate are absent
  from the DOM and client import graph. The real UI waits for authenticated staff
  actions and SSE/poll recovery exactly as the backend defines.
- **The mode boundary is enforced, not remembered**: live page/component code may
  import only `src/lib/services/` selectors, never `mock-data`, `mock-services`,
  `CURRENT_STAFF_ID` or demo components directly. Add scoped ESLint restricted-
  import rules with exceptions only for the selector layer and
  `src/components/demo/`; fix the guest receipt and staff chat violations found
  by the audit. Public live navigation never deep-links `/g/demo-table`; a demo
  deployment keeps its walkthrough links. Live API handlers keep their existing
  auth/role checks, so removing UI controls is not treated as authorization.
- **Mode is explicit and fail-closed**: `NEXT_PUBLIC_APP_MODE` becomes a required
  build value with exactly `demo | live` (tests set it explicitly too); missing,
  misspelled or contradictory mode config fails the build instead of silently
  defaulting to demo. `app-mode.ts` exposes build-time constants plus
  `assertDemoMode()`/`assertLiveMode()` — one definition used by selectors,
  route gates, service guards and server resources.
- **Demo cannot touch backend resources (INV-M1)**: `getLiveEnv()`,
  `getRawPrisma()`/`getDb()`/`getPlatformDb()`, Better Auth setup, live-service
  fetch clients, SSE/EventSource setup and background-job entry points assert
  live mode before reading secrets, constructing a client or opening a socket.
  Demo API routes return the standard 404 without importing their live handler.
  The demo must boot and complete its tour with `DATABASE_URL`, auth/QR secrets
  and email credentials absent; merely pointing those variables at real
  resources must not make demo code connect.
- **Live cannot execute mocks (INV-M2)**: wrap service implementations with tiny
  `demoOnlyService()`/`liveOnlyService()` guards so a wrong-side method call
  throws before mock state, `fetch` or timers are touched. Selectors remain the
  sole source file allowed to name both implementations, and build-time mode
  constants must eliminate the unused branch from the client/server output.
  Move response types and shared pure helpers currently imported from
  `mock-services` into neutral `types.ts`/`src/lib/` modules; after the move,
  `live-services` and `src/server` have zero runtime or type-only mock imports.
- **Ungraduated features disappear from live**: until plan 10 supplies real
  implementations, its mock-only `/admin`, `/lead` and
  `/manager/subscription` routes and navigation entry points stay demo-only;
  direct live requests return 404 and never instantiate `adminService` or
  `billingService`. Plan 10 removes those gates in the same PR that wires its
  live services. Public pricing may remain informational but cannot invoke mock
  checkout, lead capture or billing state.
- **Mutation failures recover locally**: every service-backed mutation in
  manager/staff/guest live flows gets `try/catch/finally`, an actionable
  `toast.error`, restored busy state, and no success toast before the server
  confirms. Draft/dialog state remains available for retry. No global mutation
  framework or form dependency; demo-only fast-forwards and plan-10-owned
  admin/lead/subscription screens are excluded.
- **Migration markers become truthful**: audit `TODO(backend)`, prototype notes
  and “arrives with the backend” copy against plans 01–09. Delete fulfilled
  markers and update AGENTS.md/DDD/plan exit notes where behavior changed. Keep
  plan-10 markers and Phase-3 items (`Stripe Connect`, real chart library, native
  apps, POS/KDS, offline and multi-venue) explicitly untouched.

## Implementation strategy

1. **Add-on demo checkpoint**: extend neutral types, category/package mock data
   and `mockMenuService` category CRUD; migrate repeated item modifiers to
   category presets; build manager category/preset + package-preset editors,
   guest quantity chooser, independent cart math and all order/receipt displays.
   Keep new live entry points behind `isDemoMode()` and preview-drive create
   category → configure washers/presentation → order bottle and package → staff
   fulfillment. No Prisma/API work starts until this flow is accepted.
2. **Add-on graduation**: write failing INV-O5 pricing tests first; add category/
   package preset persistence and Zod schemas; extend category CRUD and package
   routes/services; change order input to ids+quantities and resolve/price/lock
   add-ons server-side; add washer ledger movements and structured presentation
   detection; wire live selectors and remove the demo-only gate. Drop the old
   item-level `modifierGroups` column/field only after mock and live consumers use
   category presets.
3. Staff identity: schema/migration for `StaffProfile.role`, invitation draft
   fields and shift FK; `staff-core`/schemas/routes; floor-role → access-role
   invite mapping; profile creation on accept; live service swap; server-derived
   attribution for claims/show/chat.
4. Session/table invariant: settlement fields + schema; locked transaction for
   approval/close; reservation-aware release; service/API shape; staff closure
   dialog and realtime refresh.
5. Venue time: config fields + defaults/seeds/types/Zod; refactor `night.ts` and
   all analytics/report callers; settings timezone, weekly hours and night-window
   controls.
6. Mode boundary: inventory every simulation, prototype helper, `/g/demo-table`
   link and direct mock import; extract demo-only leaf controls + sandbox banner;
   give live empty/waiting states real copy and navigation; require/validate the
   build mode; add mode guards at service and backend-resource boundaries; move
   mock-owned contracts/helpers into neutral modules; demo-gate ungraduated
   plan-10 routes/navigation; add restricted-import enforcement; verify separate
   demo/live builds and update `/demo` walkthrough copy without weakening the
   permanent sandbox (AD-14).
7. Failure UX: audit service-backed mutation handlers under `/manager`, `/staff`
   and `/guest`; add page-local recovery; exercise representative conflict,
   validation and network-failure paths. Do not touch plan-10 surfaces.
8. Truth pass: grep migration markers and stale prototype copy; delete only
   items fulfilled by plans 01–09/09b; update DDD invariants, AGENTS.md gotchas,
   affected plan exit notes and the roadmap in the same PR.

Run `npx tsc --noEmit` after each numbered workstream. Each workstream is its own
verified commit when its relevant unit/integration slice is green; UI work also
gets the preview flow before its checkpoint.

## Testing

- Demo behavioral checkpoint (before backend code): create and edit a category;
  add two washer options and LED-board/light-show presentation options; verify
  every item in that category inherits the edit without touching item records;
  configure a package separately; add two bottles + three paid washers and assert
  the cart shows the hand-computed total and quantities; place it and verify the
  guest/staff/manager/receipt views agree. Delete is blocked while items reference
  the category; inactive categories/options disappear for guests.
- Unit (test-first): INV-O5 pins `2 × $200 + 3 × $6 = $418`; changing line
  quantity never multiplies add-on quantity; zero/max/required/distinct-selection
  rules; multiple washer + presentation choices; cents-exact fees, happy hour and
  promotion stacking over base + add-ons; package pricing uses the same formula.
  Structured presentation detection ignores labels/localization.
- Integration: category CRUD + preset round-trip and delete guard; package preset
  round-trip; tenant isolation for both. Order submission rejects forged price/
  name, unknown option, excessive quantity, missing required choice, duplicate
  selection, inactive preset and insufficient washer stock. Success snapshots
  authoritative fields and writes one washer movement per selected inventory
  item; concurrent orders cannot oversell; forced failure rolls back base/package
  and washer draw-downs together.
- Unit: staff-role ↔ organization-role mapping for all four roles; venue-time
  schema rejects invalid IANA zones, duplicate days, malformed `HH:mm` and equal
  night boundaries; `night.ts` covers custom windows and DST edges without
  regressing the 18:00→10:00 defaults.
- Integration: current staff equals the authenticated user; list/update/suspend/
  remove are tenant-scoped; invite acceptance creates the exact profile/role and
  is single-use; removing staff clears their shifts; payload spoofing cannot
  change claim/chat/show attribution. Apply `expectTenantIsolation()` to staff
  profiles and a wrong-role 403 to every manager-only mutation.
- Integration: approval occupies the table atomically; two sessions cannot both
  become active; auto-approve obeys the same lock; denial does not move the table;
  close requires a valid external settlement method, rejects in-flight orders,
  and releases to reserved/open correctly. Forced event-write failure rolls back
  both session and table changes.
- Integration: venue time settings round-trip through `/api/venue`; summary and
  rollup select the same custom business-night window after a settings change;
  tenant A's time config never affects tenant B.
- Boundary/static: ESLint rejects direct mock/demo imports from live UI. Build
  once with `NEXT_PUBLIC_APP_MODE=demo` and once with `live`; inspect the live
  client output for simulation labels and mock-only identifiers. A live build
  must not contain callable guest status/progress helpers, while the demo build
  must retain all walkthrough fast-forwards.
- Unit: mode parser accepts only explicit `demo`/`live`; each wrong-side service
  guard throws before invoking a spy implementation; backend assertions reject
  demo before `PrismaPg`, Better Auth, EventSource or `fetch` constructors run.
  Missing/typo mode fails configuration validation.
- Integration isolation canary: start demo with no live secrets and spies on DB,
  auth, HTTP and SSE connection factories; drive the full demo and assert zero
  calls. Hit every `/api/**` route in demo and assert the standard 404 without a
  Prisma client being created. In live, call every selector once and assert no
  mock store/delay/uid function runs.
- Import/build canary: `npx eslint src` reports any wrong-side import; grep
  `src/lib/live-services` + `src/server` for `mock-data|mock-services` and require
  zero matches after contracts move. Inspect both Next build traces: demo output
  contains no Prisma adapter, Better Auth server or live-service fetch chunk;
  live output contains no mock-data seed literal or demo-control chunk.
- E2E: invite a runner → accept/sign in → staff header shows that runner → claim
  and deliver an order → analytics attributes it to that runner; second context
  approves a guest → floor map becomes occupied → guest requests closure → staff
  records terminal settlement → floor map returns open/reserved.
- E2E add-ons: manager edits Vodka presets → guest sees the change without an
  item edit → chooses independent washer quantities + light show on a bottle and
  package → server total matches cart → staff order and show queue display exact
  quantities → receipt matches stored snapshots after the manager changes the
  preset price.
- E2E: force one rejected order claim, session close and venue save; each screen
  shows the server error, re-enables its control and preserves retryable input.
  Preview-drive settings across a custom timezone/night window, then run the
  full `npm run test`, `npm run test:integration`, named Playwright flow and
  `npx next build` ladder from AGENTS.md §5/§7b.
- E2E mode matrix: in demo, the sandbox banner and labeled host/progress/closure
  fast-forwards are present and complete the tour. In live, assert those labels,
  persona shortcuts, admin password gate and every `/g/demo-table` action are
  absent; approve/progress/close only from a second authenticated staff context
  and confirm the guest updates through live events.
- E2E network matrix: intercept `/api/**`, SSE and the configured database/auth
  hosts during the demo tour and fail on any request; the tour must stay green.
  In live, block access to mock-only plan-10 routes and assert `/admin`, `/lead`
  and `/manager/subscription` are absent/404 until plan 10 graduates them.

## Review checklist

- Is any item-level modifier array still a source of truth, or do items resolve
  category presets exactly once?
- Can request JSON influence an add-on name, kind or price, bypass required/max
  rules, or decrement washer inventory by `lineQuantity × addOnQuantity`?
- Does every cart/order/receipt surface use INV-O5, with no leftover
  `(base + modifiers) × quantity` formula?
- Do washer selections participate in the inventory ledger/86 flow, and does a
  presentation option reach the show queue without matching display text?
- Was the complete add-on UX accepted in demo mode before schema/routes landed,
  with its live gate removed only when mock and live contracts both passed?
- Can any live staff read/write still import or dynamically load
  `mock-services/staff-service`?
- Can a client claim an order, start a show or send chat as a different user by
  changing request JSON?
- Can two approvals occupy the same table, or can closing one session release a
  table still held by another session/reservation?
- Does every business-night query receive the persisted venue config rather than
  fall back silently to Toronto/demo assumptions?
- Can a live page import mock data, a mock service, `CURRENT_STAFF_ID` or a demo
  helper without ESLint failing?
- Can any demo path construct Prisma/Better Auth, call a live API, open SSE or
  read a live secret before `assertLiveMode()` rejects it?
- Can any live selector reach mock state even through a dynamic import, type-only
  dependency or shared helper? Are selectors the only allowed dual imports?
- While plan 10 is pending, can a live user reach any admin/billing/lead route or
  navigation item that would otherwise fall back to a mock service?
- Does searching the rendered live app for `Simulate`, `Prototype control`,
  `Demo only` and `/g/demo-table` return no operational control or link?
- Are live waiting, order progress and closure usable end-to-end with no hidden
  fast-forward, and are their mutation endpoints still authenticated server-side?
- After every rejected mutation, are busy state, draft state and toast feedback
  correct without a hard reload?
- Does the remaining `TODO(backend)` set describe only plan 10 or explicit Phase
  3 work, with no fulfilled plan-01–09 marker left behind?

## Exit criteria

Live staff identity/roster has zero mock delegation and actions are attributed to
the authenticated worker; guest approval/closure drives table state atomically
with external-settlement evidence; venue timezone/hours/night boundaries persist
and drive analytics. Managers have full category CRUD and category/package add-on
presets; guests select independent washer quantities/presentation services; cart,
server, inventory, fulfillment and receipt agree in cents and stored snapshots.
Demo mode is visibly a sandbox while live mode contains no simulation control,
demo-table shortcut or direct mock import; consequential live mutations recover
visibly from failure. Demo completes with zero backend-resource connections and
no live secrets; live build/runtime contains and executes no mock-data, mock
service or ungraduated plan-10 surface. The plan-01–09 migration markers and
documentation tell the truth. The two-context night flow is green in both mode
builds, the full verification ladder passes, and plan 10 can begin without
inheriting an operational seam.
