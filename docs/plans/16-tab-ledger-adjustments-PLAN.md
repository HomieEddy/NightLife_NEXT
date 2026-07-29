# 16 — The Tab as a Financial Object: minimums, adjustments, transfers & cash-out · PLAN

**Status: not started — demo track first (AD-14).**

Goal: a `GuestSession` stops being "a bag of orders you can sum" and becomes the
venue's **tab** — a financial object with a commercial term (minimum spend), a
correction vocabulary (void / comp / discount, each with a reason and an author),
a mobility model (transfer, merge, split), and a nightly close (per-shift
reconciliation). Every mutation of money after an order is placed is recorded on
an **append-only adjustment ledger** and mirrored into a venue-wide **audit
trail** that plans 17–19 also write to.

Preconditions: plan 05 (orders & fees, `INV-O2` money math), plan 06 (sessions),
plan 09b (live staff identity — an adjustment must name a real person), plan 15
(capability matrix — the new actions are rows in it).

Closes: `docs/BUSINESS-LOGIC-GAP-REVIEW.md` §2 in full, §7's audit-log finding,
and §3's tip-distribution *basis* (distribution itself is plan 18).

## Reasoning

Three findings in the gap review are actually one problem. `minimumSpend` is
stored on `VenueTable` and never read. `order:gift` waives a whole order and
nothing else can be waived. `SettlementMethod` is stamped and never rolled up.
All three exist because the session was modelled as a *view over orders* rather
than as an account. Once you add an account, all three become the same feature:
a running balance that things happen to, and a record of who made them happen.

Interpretation choices (per AGENTS.md §1.4):

- **Money still never moves.** Payment processing stays out of scope (PRD §4).
  An adjustment changes what the venue *says is owed*; settlement remains an
  external till. This plan makes the number honest, it does not charge anyone.
- **Void ≠ comp ≠ discount.** They are three different business events and the
  most common mistake is collapsing them:
  - **void** — it never happened (wrong bottle rung in). Removes the line from
    revenue **and returns stock to inventory**.
  - **comp** — it happened, the guest doesn't pay (service recovery, house
    hospitality). Stays in depletion and staff-performance volume, leaves
    revenue, lands in a comp cost bucket.
  - **discount** — it happened, the guest pays less (manager goodwill, negotiated
    table deal). Reduces revenue by the delta only.
  Getting this wrong is exactly how inventory variance and staff analytics rot,
  which is the review's stated objection to today's all-or-nothing gift.
- **Reason codes are mandatory, not free text.** A venue-configurable enum with a
  free-text note. Unreasoned adjustments are the thing owners actually complain
  about; a required dropdown is the whole control.
- **Minimum spend is a commitment, not a paywall.** We surface progress and warn
  at closeout; we never block ordering. The shortfall appears as an explicit
  receipt line so the host can have the conversation.
- **Order-level `gift` survives** as a shorthand that compiles down to a
  full-order comp — no call-site churn, one ledger.

## Design choices

### Data model

- **`TabAdjustment`** (new, append-only) — the ledger:
  `{ id, venueId, sessionId, orderId?, orderItemId?, kind: "void"|"comp"|"discount",
  amountCents, reasonCode, note?, authorStaffId, authorStaffName, createdAt,
  reversedByAdjustmentId? }`. Corrections are new rows (a reversal), never edits
  — same rule as `StockMovement` (INV-I1).
- **`AdjustmentReason`** — venue config, seeded per kind
  (void: `wrong-item`, `mis-rung`, `guest-changed-mind`; comp: `service-recovery`,
  `house-hospitality`, `vip`, `staff-error`; discount: `negotiated-table`,
  `manager-goodwill`, `event-deal`). Editable in `/manager/settings`.
- **`SessionBalance`** — **derived, never stored** (same rule as `AttentionItem`):
  `grossCents`, `adjustmentsCents` by kind, `netCents`, `minimumSpendCents`,
  `shortfallCents`, `settledCents`. One pure function in `src/lib/tab.ts`,
  consumed by the guest receipt, the host session sheet and the cash-out report.
- **`Order.status` gains `voided`**? **No.** Voids are adjustments, not a status
  — an order can be partially voided. `cancelled` remains pre-delivery only, and
  this plan documents that boundary (the review's "no refund path" finding: a
  post-delivery reversal is a void adjustment, not a status change).
- **`GuestSession`** gains `minimumSpendCents` (snapshot from the table at
  approval — table config changes must not rewrite an open tab), `parentSessionId`
  (merge), and `transferredFromTableId?` history.
- **`AuditEntry`** (new, append-only, venue-scoped) —
  `{ id, venueId, actorStaffId, actorName, action: StaffAction|AdminAction,
  targetType, targetId, summary, metadata, createdAt }`. Every action already
  flagged `sensitive: true` in `ACTION_META` writes one, plus the new actions
  here. This is deliberately generic: plans 17 (refusals, ejections), 18 (schedule
  edits, payout runs) and 19 (stock corrections) write to the same table.
- **`ShiftCashout`** (new) — `{ id, venueId, staffId?, businessDate, openedAt,
  closedAt, expectedByMethod: Record<SettlementMethod, cents>, countedByMethod,
  varianceCents, note, closedByStaffId }`. The Z-report.

### Behaviour

- **Minimum-spend progress.** A ring/bar on the host's session sheet and on the
  guest receipt tab: `net / minimum`. At last call, `computeAttentionItems()`
  gains a `table-under-minimum` attention type (severity from the shortfall
  ratio) — it reuses the existing Pulse plumbing rather than inventing an alert
  surface. Shortfall renders as its own receipt line.
- **Adjustment flow.** From the order card (staff and manager): *Adjust* →
  choose scope (whole order / one line / partial quantity) → kind → reason →
  optional note → `ConfirmDialog` naming the object and amount ("Comp 1 × Grey
  Goose 750ml — $180.00 — service recovery?"). Void additionally shows
  "returns 1 unit to inventory".
- **Inventory coupling (the correctness crux).** A **void** writes a
  `StockMovement` of type `adjustment` with a `voidAdjustmentId` back-reference,
  inside the same transaction as the `TabAdjustment` (INV-I1 must hold at every
  instant). A **comp** and a **discount** write **no** movement — the product left
  the building.
- **Transfer / merge / split.**
  - *Transfer*: move an open session to another table. Re-snapshots
    `minimumSpendCents`? **No** — the original commitment travels with the party
    (a host override can change it explicitly, audited). Both table statuses
    update in one transaction.
  - *Merge*: child session's orders re-point to the parent; child becomes
    `merged` with `parentSessionId`; the higher of the two minimums applies.
  - *Split by item*: `evenShares()` is kept for the even case and joined by an
    item-assignment split producing N receipt views over one session. Splitting
    never creates new orders.
- **Bottle-service terms on reservations.** `Reservation` gains
  `packageId?` and `minimumSpendCents?`; at seating, the session's minimum is
  taken from the reservation when present, else the table. This makes
  `BottlePackage` reachable at booking time (gap review §2, last bullet).
- **Cash-out.** `/manager/cashout` (and a staff-side "close my drawer" for
  bartenders): expected-by-method from the session ledger for the business date,
  counted entered by the closer, variance computed and audited. Cover-charge
  totals by admission type (plan 17's `Admission.amountOwedCents`) appear in
  the reconciliation alongside order settlement methods — cover charges are a
  significant revenue line and must not be invisible in financial reporting.
  Business date comes from the venue's `nightStartHour`/`nightEndHour` — never
  `toDateString()`.
- **Tip basis.** Tips are already captured per order; this plan adds the
  attribution *basis* (`tipCents` grouped by claiming staff and by shift) and
  exposes it as a read. **Distribution/pooling is plan 18** — 16 makes the number
  available, 18 decides who gets it.

### Capability matrix additions (plan 15's table gains rows)

| Action | manager | host | bartender | runner | security | promoter |
|---|---|---|---|---|---|---|
| `tab:void` | ✓ | ✓ | ✓ | — | — | — |
| `tab:comp` (≤ venue threshold) | ✓ | ✓ | — | — | — | — |
| `tab:discount` | ✓ | — | — | — | — | — |
| `tab:transfer` / `tab:merge` | ✓ | ✓ | — | — | — | — |
| `tab:override-minimum` | ✓ | — | — | — | — | — |
| `cashout:close` | ✓ | — | ✓ (own drawer) | — | — | — |
| `audit:read` | ✓ | — | — | — | — | — |

All are `sensitive: true` and all write `AuditEntry`. A venue-configurable
**comp threshold** escalates above-threshold comps to manager approval rather
than denying them.

### Manager surfaces

- `/manager/orders` — adjustment action on each card; adjusted orders render an
  amended total with a strike-through original.
- `/manager/cashout` — tonight's reconciliation, history by business date.
- `/manager/settings` — reason codes, comp threshold, minimum-spend warning
  ratio.
- `/manager/audit` — filterable audit trail (actor, action, date). Manager-only.
- Analytics gains **comp/void/discount rate** cards and a
  `adjustmentsByReason` breakdown; report engine gains the matching metrics
  (plan 09c's mechanism, no new engine).

## Implementation strategy

Demo track:

1. **Types + pure math first** (`types.ts`, `src/lib/tab.ts`): `TabAdjustment`,
   `AdjustmentReason`, `AuditEntry`, `ShiftCashout`, session/reservation field
   additions; `computeSessionBalance()`, `computeShortfall()`,
   `computeCashoutExpected()`. Unit tests before the code (§7b.3 — this is money
   math).
2. **Mock services**: `orders-service` adjustment methods, `guests-service`
   transfer/merge/split + balance reads, new `audit-service`, `cashout-service`;
   `menu-service` void→movement coupling.
3. **Capability matrix rows** + `ACTION_META` entries; audit write helper wired
   into every `sensitive` action that already existed.
4. **UI**: adjustment dialog (one shared component, used from staff and manager
   order cards), minimum-spend progress on session sheet + guest receipt,
   transfer/merge/split on the session sheet, `/manager/cashout`,
   `/manager/audit`, settings tab, analytics cards.
5. **Pulse**: `table-under-minimum` attention type.

Live track (graduation):

6. Prisma models (`tab_adjustments`, `audit_entries`, `shift_cashouts`,
   `adjustment_reasons`) — ledgers INSERT-only per DDD §6; adjustment + stock
   movement in one transaction with the item row locked (INV-O4's rule extended).
7. Route handlers with Zod boundaries; capability checks server-side; domain
   events `TabAdjusted`, `SessionTransferred`, `SessionsMerged`, `CashoutClosed`
   published so the host's session sheet updates live (AD-6).

## Testing

- **Unit (test-first):** balance math with mixed adjustments; void returns stock
  and comp does not; discount reduces net by delta only; shortfall at exactly the
  minimum is zero; merge takes the higher minimum; partial-quantity void of a
  line with add-ons prices correctly (INV-O5 interaction); cash-out variance
  including a negative; business-date bucketing across `nightEndHour`.
- **Invariant canaries:** `INV-T1` net = gross − Σ adjustments, always;
  `INV-T2` `item.inventory === Σ movements.delta` still holds after any void
  (extends INV-I1); `INV-T3` an adjustment's `amountCents` never exceeds the
  remaining un-adjusted amount of its target (no over-comping).
- **Integration (live):** wrong-role 403 for each new action; comp above
  threshold by a host → 403/escalation; tenant-isolation canary on every new
  route; concurrent double-void of the same line → one succeeds (row lock).
- **E2E (demo):** place order → deliver → void one line → inventory ticks back up
  → comp another → receipt shows amended total and shortfall vs. minimum → close
  the tab → cash-out shows the expected split by method → audit trail lists both
  adjustments with actor and reason.

## Review checklist

- Does any code path mutate a `TabAdjustment` or delete one? (Must be
  reversal-only.)
- Is every new sensitive action writing an `AuditEntry` in the *same transaction*
  as its effect, not after it?
- Is `minimumSpendCents` snapshotted at approval, so editing the table's minimum
  mid-night can't rewrite an open tab?
- Does the comp path deliberately leave inventory alone, and is that documented
  at the call site?
- Business date everywhere from venue night config — grep for `toDateString`,
  `getDate()` in the new code.
- Does the guest receipt still render deterministically (§9.8 UX invariant) with
  adjustments present?

## Exit criteria

A host can seat a VIP table with a $2,000 minimum, watch the progress ring fill,
void a mis-rung bottle (stock returns), comp a round for a spilled drink (stock
does not return), move the party to a bigger table, merge a friend's tab in, and
close out — and at 04:00 the manager opens one page that reconciles the night by
settlement method, and another that shows every adjustment with who made it and
why. No number on any of those screens is derivable two ways.
