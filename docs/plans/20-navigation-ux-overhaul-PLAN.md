# 20 — Navigation & UX Overhaul · PLAN

**Status: complete.** The staff-scoped command palette landed with plan 30 §6.3.

Goal: the manager area has grown from a prototype's page list into an 18-item
flat sidebar — and plans 16–19 add roughly ten more destinations. Before that
lands, the navigation model has to change. This plan restructures information
architecture across all three shells, adds the findability layer the app has
never had (grouped nav, ⌘K command palette, global search), hoists live
attention out of a single dashboard tab, and fixes the systemic interaction gaps:
active-state logic, breadcrumbs, URL-backed view state, keyboard model, undo, and
`aria-current`.

Preconditions: none hard — this is presentation-layer and touches no service
contract. **Sequencing matters though:** it lands *before or alongside* the
graduation of plans 16–19's UI so their new surfaces are added into the new
IA rather than bolted onto the old one. If 16–19 sketch first, they add their
nav entries to the grouped structure this plan defines.

Closes: all 14 findings of the 2026-07-26 UX review (absorbed into
`docs/ROADMAP.md` on 2026-07-30).

## Reasoning

The UX review's central observation is that this app has three navigation models
and only one of them is under strain. The guest portal (4 tabs) and the staff
panel (role-filtered bottom nav) are good and get small additions. The manager
area is the problem, and it's about to get much worse: plans 16–19 introduce
cash-out, audit, door, incidents, guests, waitlist, tips, purchasing, stocktake
and suppliers. Adding ten items to a flat list of eighteen produces a menu nobody
can scan, and on mobile a horizontally-scrolling pill strip where twenty-odd
destinations are off-screen with no affordance that they exist.

Interpretation choices (per AGENTS.md §1.4):

- **One nav definition, two presentations.** The desktop sidebar and the mobile
  navigation must render from the same grouped structure. Today they're two
  literals that happen to agree; that's why they already disagree about what
  "active" means.
- **Grouping beats search, and both beat neither.** Groups fix scanning for the
  destinations you use nightly; the palette fixes reaching the ones you use
  monthly. Ship groups first — it's the cheaper half and it's the one that makes
  the app *feel* organised.
- **The palette is entity-first, not page-first.** In an ops app you're looking
  for order `A-042` or table `VIP-01` far more often than for a page. The repo is
  unusually ready: `entity-links.ts` already centralises every entity URL and
  `EntityChip` already renders results.
- **Undo replaces confirmation only where reversal is real.** The review is right
  that a modal per order transition trains reflexive confirmation, but the house
  rule (AGENTS.md §4.5) exists for good reason. The resolution is an explicit,
  documented split — and AGENTS.md §4.5 gets edited in this PR, per §9.9.
- **UI is out of scope.** No restyling, no new visual language. Plan 11 owns the
  look; this plan owns where things are and how you get to them.

## Design choices

### 1. Grouped navigation (`src/lib/navigation.ts` — one source of truth)

A single exported structure consumed by `ManagerShell` (desktop + mobile),
the command palette and any future nav surface:

```
TONIGHT      Dashboard · Orders · Door · Chat
FLOOR        Floor map · Zones · Tables · QR codes
CATALOGUE    Menu · Inventory · Purchasing · Happy hour · Promotions
BOOKINGS     Reservations · Waitlist · Events · Guests
TEAM         Staff · Schedule · Tips
INSIGHTS     Analytics · Reports · Cash-out · Audit · Incidents
—            Settings · Subscription        (sidebar footer, not the scroll)
```

- Groups are collapsible; collapse state persists in `localStorage` via the
  existing demo-persistent-flag helper (AGENTS.md §3.6).
- Entitlement filtering (`hasFeature`) applies per item; a group with zero
  visible items hides entirely.
- Settings and Subscription move to the footer beside the venue name — account
  chrome, not operations (review §1).
- Group membership for plans 16–19's surfaces is fixed here so those plans don't
  each invent a placement.

### 2. Mobile manager navigation (review §2 — the worst finding)

Replace the overflow pill strip with the pattern the rest of the app already
uses: **`MobileBottomNav` with four primaries + More**.

- Primaries: **Dashboard · Orders · Floor map · More**.
- **More** opens a full-height `Sheet` (already in `src/components/ui`) rendering
  the *same grouped structure* as the desktop sidebar.
- The product now has one mobile navigation idea instead of two.
- `MobileBottomNav` gains a `badgeCount` on Orders (see §4) — the component
  already supports it and only the guest cart uses it today.

### 3. Command palette + header search (review §3)

- **`⌘K` / `Ctrl+K`** palette, hand-rolled on the existing `Dialog` primitive —
  no `cmdk` dependency (AGENTS.md §2.4: earn every dependency; the surface here
  is a filtered list and a keydown handler).
- Three result groups, in this order:
  1. **Entities** — orders by code, tables by code, staff by name, reservations
     and guests by name, menu items. Fan-out over existing service `list*`
     methods, debounced, rendered as `EntityChip`s, routed through
     `entity-links.ts`.
  2. **Navigation** — every item in the grouped structure.
  3. **Actions** — "Start last call", "Send broadcast", "New reservation",
      "Report an incident", "Open stocktake". **Done 2026-07-28** — action commands
      implemented in `action-commands.ts` with scope support (manager/staff),
      service dispatch, and role gating. Each is a registered action with a
      capability guard; actions the role lacks never appear.
- A **persistent search input in the manager header** opens the same palette —
  a large share of users never discover a keyboard shortcut (review §3).
- Staff panel gets the palette too, scoped to their capabilities (search an order
  code, jump to help, report an incident). Guest portal does not.

### 4. Attention everywhere (review §4)

`computeAttentionItems()` already runs app-wide via `useLiveEvents`; it renders
in one tab of one page. Hoist it:

- **`AttentionProvider`** at the shell level owning the live attention list.
- **Bell + count in the manager header and sidebar footer**, opening a `Sheet`
  with the same items the Pulse tab renders (one component, two mounts).
- **Nav badge counts**: Orders (overdue), Door (capacity warning, plan 17), Chat
  (unread), Staff (coverage gap, plan 18), Inventory (below par, plan 19).
  Counts derive from the same attention list — no second computation.
- **Critical items raise a toast** wherever the user is (`Toaster` is already
  mounted globally), deduplicated by item id so a persistent problem toasts once.
- Staff bottom nav gains counts on Orders, Help and Approvals.

### 5. Consistent active state + `aria-current` (review §5, §13)

One helper, `isNavActive(pathname, href)`, matching on **full segment
boundaries**, used by `ManagerShell`, `MobileBottomNav` and the More sheet. Every
active link gets `aria-current="page"`. This kills the two-components-disagree
bug before the detail routes in plans 16–19 arrive to expose it.

### 6. Breadcrumbs (review §6)

`PageHeader` gains an optional `breadcrumbs` prop (it already owns
title/description/actions, so one prop applies everywhere at once). Rule: any
route two or more segments past its area root renders one. Detail pages entered
from a list also render a back link that **preserves the list's filters** — which
requires §7.

### 7. URL-backed view state (review §7, §10)

- **Tab state → URL** (`?tab=pulse`) on the dashboard, analytics, inventory,
  settings and staff pages, using the established `useSearchParams` + `Suspense`
  pattern. Deep-linkable, shareable, and browser Back does the right thing.
- **List filters/sort/search → URL** on Orders, Inventory, Reservations, Staff,
  and every list plans 16–19 add. This becomes a house rule alongside
  `entity-links.ts` and is recorded in AGENTS.md §3.
- Promote the dashboard's **Pulse** tab to a real route (`/manager/pulse`) — it's
  a destination, it needs a nav entry and a badge, and it's what a manager
  actually leaves open.

### 8. Keyboard model (review §8)

- `⌘K` palette · `/` focuses the page's search · `?` shows the shortcut list ·
  `g` then a letter jumps to a group's first item · `Esc` closes any overlay
  (verify no handler swallows Radix's).
- **Focus moves to the page `<h1>` on route change** — currently keyboard and
  screen-reader users restart from the top of the nav on every navigation.
- One small registry (`src/lib/shortcuts.ts`) so shortcuts are declared, not
  scattered, and the `?` sheet is generated from it.

### 9. Undo policy (review §9)

An explicit split, applied consistently and written into AGENTS.md §4.5 in the
same PR:

| Pattern | Applies to |
|---|---|
| **Optimistic + 5s undo toast** | order status transitions, claim/release, table status toggle, help acknowledge, shift toggle, waitlist reorder |
| **Keep `ConfirmDialog`** | anything money-touching (comps, voids, discounts, cash-out close, tip distribution), deletes, cancellations, ban/refusal, incident submit, publish schedule, plan changes, last call, stocktake commit |

The rule of thumb, stated once so future features don't relitigate it: **if the
action can be silently undone with no ledger entry, use undo; if undoing it would
itself be a recorded business event, confirm it.** Note that plans 16–19 add many
rows to the right-hand column — this policy is what keeps the left column from
being empty and the right column from being everything.

### 10. First-use guidance (review §12)

`EmptyState` gains an optional primary action and hint; every empty list teaches
its one next action. Complex pages (Floor map, Reports, Happy hour, Stocktake,
Door) get a dismissible hint stored with the existing localStorage helper. No
second tour.

### 11. Role transparency (review §14)

The staff `RoleBadge` becomes tappable, showing what this role can and can't do
(generated from the capability matrix, so it can never drift). Hitting a route
the role lacks explains why instead of bouncing silently.

### 12. Guest portal persistence & discoverability (review §11)

- **In-flight order status strip:** a slim persistent banner at the top of every
  guest tab showing the count and status of active (preparing/ready) orders with
  an ETA — the Uber/Deliveroo pattern. The Orders tab badge shows the in-flight
  count.
- **Gift entry point:** a gift affordance on the menu item card and on the cart
  sheet — explicit, persistent, reachable from the tab bar's "More" or as a
  dedicated tab. Gift is a revenue feature and must be discoverable without
  knowing the URL.
- **Receipt entry point:** when a session transitions to `closure-requested`, a
  receipt CTA appears in the guest tab bar (replacing or alongside the Orders
  tab). The guest can review their tab at close without navigating away from
  their current view.

## Implementation strategy

Ordered so each step is independently shippable and verifiable:

1. **`src/lib/navigation.ts`** — grouped structure + `isNavActive` +
   `aria-current`; rewire `ManagerShell` desktop sidebar; footer for
   Settings/Subscription.
2. **Mobile**: `MobileBottomNav` for manager + More `Sheet` rendering the same
   structure. Delete the pill strip.
3. **URL state**: tabs → `?tab=`, list filters → query params; promote Pulse to
   `/manager/pulse`. (Do this before the palette so palette results can carry
   filter state.)
4. **Command palette + header search**, with the action registry and capability
   guards. Staff-scoped variant.
5. **Attention hoist**: provider, header bell + sheet, nav badges, critical
   toasts, staff nav counts.
6. **Breadcrumbs** in `PageHeader`; back-links preserving list state.
7. **Keyboard**: shortcut registry, `?` sheet, focus-on-navigation.
8. **Undo policy**: convert the reversible actions, keep the rest; update
   AGENTS.md §4.5.
9. **Empty states + role transparency.**

There is no live track: this plan changes no service, no schema and no API. It
ships identically to both builds.

## Testing

- **Unit:** `isNavActive` across every route pair in the app including the
  prefix-collision cases (`/manager/event` vs `/manager/events`); nav group
  filtering under each plan's entitlements (a Starter tenant's sidebar has no
  empty groups); palette ranking (exact code match beats fuzzy name match);
  shortcut registry has no duplicate bindings.
- **A11y (automated where cheap, manual otherwise):** `aria-current` present on
  exactly one link per shell; focus lands on `<h1>` after navigation; the palette
  is fully operable by keyboard and traps focus; bottom nav items are reachable
  in tab order.
- **E2E (both builds):** ⌘K → type an order code → land on the order with its
  list filters intact → browser Back returns to the filtered list; mobile
  viewport → More sheet → reach Inventory in two taps; an overdue order raises
  the header badge and the Orders nav count from a different page; undo a status
  transition within 5s and confirm the order reverted.
- **Preview drive on mobile and desktop viewports, both modes** (AGENTS.md §5.3)
  — this is a navigation plan; screenshots of the two shells are the evidence.
- `npx next build` — the `useSearchParams`/`Suspense` surface expands
  considerably in step 3; static generation is the check that catches it.

## Review checklist

- Is there exactly **one** nav definition and **one** active-state helper? Grep
  for a second `NAV` literal after the change.
- Does every new destination from plans 16–19 have a declared group, or did one
  get appended to the bottom of a list?
- Does the palette ever show an action the signed-in role can't perform?
- Are attention counts derived from the single attention list, or recomputed
  per badge?
- Does any converted undo action lack a real revert path (i.e. was it actually
  irreversible)?
- Does URL state survive a hard reload in live mode and degrade sanely in demo
  mode (where service state resets)?
- Did AGENTS.md §3 (URL state rule) and §4.5 (undo policy) get edited in this
  PR, per §9.9?

## Exit criteria

A manager on a laptop hits ⌘K, types "vip-01", and is on the table. A manager on
a phone reaches any of the app's thirty destinations in two taps. An overdue
order is visible from every page, not just the dashboard. Advancing an order is
one tap with an undo, while comping a bottle still asks. Every list can be linked
to a colleague in the exact state it was being read. And the app has one
navigation model expressed once, so plans 16–19 add their surfaces to a structure
instead of to a pile.
