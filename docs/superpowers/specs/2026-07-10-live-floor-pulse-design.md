# Live Floor Pulse & Escalation — Design

## Context

NightLife_NEXT is a frontend prototype (mock data, no backend) for nightclub
venue operations, with role areas `manager`, `staff`, `guest`, and `admin`.
The manager Dashboard (`/manager`) currently shows tonight-only metrics
(revenue, orders, top sellers, a handful of recent orders) — a calm,
after-the-fact summary.

This is the first of a three-part brainstorm on **nightly floor operations**
(the other two, not yet spec'd: runner/bartender dispatch + show-queue
coordination, and guest-facing floor extras like split-bill and bottle
gifting). The explicit steer from the brainstorm: this product's wedge is
being the real-time nerve center for what's physically happening on the club
floor tonight — not CRM, not back-office financial ops, not loyalty/points.
Venues already run other software for those.

The domain model already has everything this feature needs to read from:
`Order` (with `status`, `placedAt`), `HelpRequest` (`status`, `createdAt`),
`VenueTable` (`status`), `ChatMessage` (floor/bar/security channels), and
`Venue` (venue-wide config, e.g. `autoApproveGuests`, `serviceFees`).

## Goal

Give the manager a live, unified view of what needs attention right now —
overdue orders, open help requests, and (at last call) tables that still need
a close-out nudge — plus two direct-action tools: broadcasting an urgent
message to every staff device, and triggering a guided last-call sequence
that stops new orders and nudges staff toward closing tables.

Out of scope: any change to the existing "Tonight" metrics tab; new
staff-facing pages beyond a banner; persisted per-table closeout tracking
(last-call nudges are computed live, not stored); anything CRM/loyalty/
financial (per the brainstorm's explicit scope cut).

## Approach

### 1. Data model additions

```ts
// types.ts

interface Venue {
  // ...existing fields unchanged
  slaThresholds: {
    orderWarnMinutes: number;      // default 6
    orderCriticalMinutes: number;  // default 12
    helpWarnMinutes: number;       // default 4
    helpCriticalMinutes: number;   // default 8
  };
  lastCallAutoFlagTables: boolean; // default true
}

type AttentionSeverity = "warning" | "critical";
type AttentionItemType = "order-overdue" | "help-open" | "table-closeout";

interface AttentionItem {
  id: string;              // "order-{orderId}" / "help-{requestId}" / "table-{tableId}"
  type: AttentionItemType;
  severity: AttentionSeverity;
  tableId: string;
  tableCode: string;
  zoneName: string;
  message: string;         // e.g. "Order A-042 pending 8 min"
  ageMinutes: number;
}

interface Broadcast {
  id: string;
  message: string;
  sentAt: string;  // ISO
  sentBy: string;   // manager name
}
```

`slaThresholds` and `lastCallAutoFlagTables` are added to `mockVenue` in
`src/lib/mock-data/venue.ts` with the defaults above.

### 2. `src/lib/pulse.ts` — pure aggregation

Following the existing split established by `fees.ts` (pure math in
`src/lib/`, mutable state in a mock service), a single pure function does
all the aggregation with no I/O:

```ts
function computeAttentionItems(
  orders: Order[],
  helpRequests: HelpRequest[],
  tables: VenueTable[],
  thresholds: Venue["slaThresholds"],
  lastCallActive: boolean,
  autoFlagTables: boolean,
): AttentionItem[]
```

- **Order items**: for orders with `status` in `pending`/`accepted`/
  `preparing` (not yet `ready`/`delivered`/`cancelled`), compute age from
  `placedAt`. Age ≥ `orderCriticalMinutes` → `critical`; ≥
  `orderWarnMinutes` → `warning`; else no item.
- **Help items**: for `HelpRequest`s with `status !== "resolved"`, same
  pattern against `helpWarnMinutes` / `helpCriticalMinutes`, age from
  `createdAt`.
- **Table closeout items**: only when `lastCallActive && autoFlagTables` —
  one `warning`-severity item per `VenueTable` with `status === "occupied"`.
  No persisted state; recomputed every call, so toggling the setting or
  ending last call clears them immediately.
- Sorted critical-first, then by `ageMinutes` descending within each
  severity.
- Because this is a pure function of its inputs, it's the natural first
  candidate for a unit test once the test suite exists (per AGENTS.md §7).

### 3. `src/lib/mock-services/pulse-service.ts` — new live state

Holds the two pieces of state that don't belong anywhere else:

```ts
export const mockPulseService = {
  async listBroadcasts(): Promise<Broadcast[]>;
  async sendBroadcast(message: string, sentBy: string): Promise<Broadcast>;
  async getLastCallState(): Promise<{ active: boolean; startedAt: string | null }>;
  async startLastCall(): Promise<void>;
  async endLastCall(): Promise<void>;
};
```

`startLastCall()` also posts a flagged `ChatMessage` into all three existing
chat channels (floor/bar/security) via `mockStaffService`, so the moment is
in the permanent record, not just a transient banner.

### 4. Dashboard: Pulse tab

`/manager/page.tsx` gains a `Tabs` wrapper: `Tonight` (existing content,
unchanged) and `Pulse` (new), with a badge on the trigger showing the open
item count (e.g. `Pulse (3)`) — same pattern as the existing `Packages (n)`
tab trigger on the Menu page.

The Pulse tab content:
- Polls orders / help requests / tables / pulse-service every 8s (matching
  the existing `staff/orders` polling interval), only while mounted — shadcn
  `TabsContent` unmounts inactive panels, so switching to "Tonight" stops the
  polling for free.
- Renders `computeAttentionItems(...)` as a severity-grouped list (critical
  first). Each row: zone/table chip (reusing `EntityChip`), message, age,
  and a link built the same way every other cross-page link in this repo is
  built — through `entity-links.ts`. `help-open` and `table-closeout` items
  link via the existing `tableHref(tableId)` helper (already used elsewhere,
  resolves to `/manager/tables?highlight={tableId}`); `order-overdue` items
  link to the literal `/manager/orders` path — the orders feed's `query`
  state is local (not URL-driven today), so a link can land the manager on
  the feed but can't pre-filter to one order without adding search-param
  support to that page, which is out of scope here.
- Empty state: "Floor is calm — nothing needs attention."
- **Broadcast composer**: a `Textarea` + "Send to all staff" button, wrapped
  in the existing `ConfirmDialog` per the app-wide confirmation rule.
- **Last-call control**: a `ConfirmDialog`-guarded button. Shows "Start last
  call" when inactive; once active, shows "End last call" plus an elapsed-
  time badge (e.g. "Last call — 12 min").

### 5. Settings additions

New card in `/manager/settings`, positioned after the existing Fees card:
four `Input type="number"` fields for the SLA thresholds (same layout
pattern as the fee editor), plus a `Switch` labeled "Auto-flag open tables
at last call" (same pattern as the existing `autoApproveGuests` switch).
Saved via the existing `mockVenueService.updateVenue()` call already used by
this page.

### 6. Staff-side banner

New `BroadcastBanner` component, mounted at the top of `staff/layout.tsx`
(above all `/staff` pages). Two independent, non-mutually-exclusive states:

- **Broadcast**: shows the latest message from `mockPulseService
  .listBroadcasts()`, dismissible (local component state, not persisted),
  auto-expires 3 minutes after `sentAt` even if not dismissed.
- **Last call**: a persistent (non-dismissible) strip shown while
  `getLastCallState().active` — "🔔 Last call — no new orders accepted."

Both poll `mockPulseService` on the same 8s cadence.

### 7. Guest-side effect

`/guest/menu` (or the shared cart/menu data hook) reads last-call state on
its existing poll/effect. While active: a countdown-style banner appears
above the menu, and the "Add to cart" / "Place order" actions are disabled
with an explanatory line ("Kitchen's closed for the night — thanks for
being here!"). No change to already-placed orders or the existing
close-tab/bill flow.

## Data notes

- No new mock-data seed files needed — `AttentionItem`s are entirely derived
  from existing `mockOrders`, `mockHelpRequests` (via `mockGuestsService`),
  and `mockTables`. Only `Broadcast[]` and the last-call flag are net-new
  mutable state, living in `pulse-service.ts`.
- `Venue.slaThresholds` and `lastCallAutoFlagTables` need defaults added to
  `src/lib/mock-data/venue.ts` alongside the existing `serviceFees` seed.

## Testing / Verification

Manual verification via `preview_*` tools once implemented:
1. Seed one mock order with an old `placedAt` (or temporarily lower a
   threshold in Settings) → confirm it appears in the Pulse tab as
   `critical`, with the correct age and link.
2. Resolve/deliver that order → confirm it disappears from the feed on the
   next poll.
3. Send a broadcast from the Pulse tab → confirm the full-screen banner
   appears on a `/staff` page and a flagged message lands in the relevant
   chat channel.
4. Dismiss the broadcast banner → confirm it doesn't reappear; wait (or
   simulate) past 3 minutes → confirm auto-expiry.
5. Start last call with "Auto-flag open tables" on → confirm every occupied
   table shows as a `table-closeout` item, the guest menu blocks ordering,
   and the staff banner shows the persistent last-call strip.
6. Toggle "Auto-flag open tables" off in Settings, restart last call →
   confirm no `table-closeout` items appear, but the guest-blocking and
   staff banner still work.
7. End last call → confirm the guest menu unblocks and the staff banner
   clears immediately.
8. Confirm the Pulse tab badge count matches the visible item count, and
   that switching to "Tonight" and back doesn't duplicate polling intervals.
