# 19 — Cost, Supply Chain & Profitability · PLAN

**Status: not started — demo track first (AD-14).**

Goal: the app knows what everything sells for and nothing about what it costs.
This plan adds the **cost side** — suppliers, purchase orders with unit costs,
par levels and reorder alerts, physical stocktakes with variance, waste as its
own event, and partial-bottle (by-the-pour) tracking — and then turns every
existing revenue report into a **margin** report: pour cost, gross margin by
item/category/night, theoretical-vs-actual variance, and targets with alerting.

Preconditions: plan 04 (menu/inventory ledger, `INV-I1`), plan 09/09c (analytics
+ report engine), plan 16 (void adjustments write inventory movements — costing
must account for them), plan 18 (labour cost — the other half of margin).

Closes: `docs/BUSINESS-LOGIC-GAP-REVIEW.md` §6 in full and §8 in full.

## Reasoning

`StockMovement` is already a correct append-only ledger — the hard, easy-to-get-
wrong part is done. What's missing is that a `restock` movement is a bare
quantity with no money and no counterparty. That one omission is why the review
says "analytics can report revenue but never profit", and it cascades: no COGS,
no pour cost, no margin, no supplier performance, no purchasing workflow, and no
way to distinguish shrinkage from a counting error.

Interpretation choices (per AGENTS.md §1.4):

- **Cost is carried on the movement, not on the item.** Bottles bought at
  different prices must cost out at what they actually cost. Each inbound
  movement carries `unitCostCents`; consumption values at **weighted average
  cost** recomputed on each receipt. FIFO is more precise and much more
  machinery; WAC is what bar inventory systems actually use and it's defensible.
  This is stated here so the choice isn't relitigated later.
- **Par levels are per-item and per-day-of-week.** A Wednesday par and a
  Saturday par are different numbers in a nightclub; a single par level would be
  wrong five nights out of seven and get ignored.
- **Waste is not an adjustment.** A spill, a breakage and a miscount are three
  different business events with different follow-up. `StockMovementType` gains
  `waste` and `transfer`; `adjustment` narrows to "the count was wrong".
- **Partial bottles are measured in the item's own unit.** `MenuItem` gains
  `unitOfMeasure` (`bottle`|`ml`|`oz`|`each`|`keg`) and `servingSize`, so a
  bottle opened for by-the-glass service depletes in pours while a table-service
  bottle depletes as one. Without this the ledger can never reconcile for a bar
  that sells both ways — which is every bar.
- **A stocktake is a session, not a button.** Count sheets, a second counter for
  high-value items, then a single commit that writes one `adjustment` movement
  per discrepancy with the stocktake as its reason. Variance is the output, and
  variance is the number owners actually manage.
- **Purchase orders record commitments; they don't pay anyone.** Consistent with
  the product's stance everywhere else (PRD §4) — the app produces the number and
  the paper trail, the money moves outside.

## Design choices

### Data model

- **`Supplier`** — `{ id, venueId, name, contactName?, email?, phone?,
  accountNumber?, leadTimeDays, orderDays: number[], minimumOrderCents?,
  notes, active }`.
- **`SupplierItem`** — the catalogue join: `{ supplierId, menuItemId,
  supplierSku?, caseSize, caseCostCents, unitCostCents (derived),
  lastPriceChangeAt, preferred: bool }`. Multiple suppliers per item, one
  preferred — price comparison falls out for free.
- **`PurchaseOrder`** (root) — `{ id, venueId, supplierId, code, status:
  "draft"|"submitted"|"partially-received"|"received"|"cancelled",
  expectedAt?, submittedAt?, submittedByStaffId, lines: PurchaseOrderLine[],
  subtotalCents, notes }`.
- **`PurchaseOrderLine`** — `{ id, menuItemId, qtyOrdered, qtyReceived,
  unitCostCents, lineTotalCents }`.
- **`StockMovement`** gains `unitCostCents?`, `purchaseOrderId?`,
  `stocktakeId?`, `wasteReason?`, and `type` widens to
  `"restock"|"sale"|"adjustment"|"waste"|"transfer"|"return"`.
  `restock` movements without a PO stay legal (a corner-store run happens) but
  require a manual `unitCostCents`.
- **`MenuItem`** gains `unitOfMeasure`, `servingSize`, `parLevels:
  Record<dayOfWeek, number>`, `reorderPoint`, `avgCostCents` (rollup, recomputed
  on receipt — never hand-edited), `isAlcoholic`, `abv`, `allergens: string[]`
  (the last three are also consumed by plan 17's responsible-service counter).
- **`Stocktake`** (root) — `{ id, venueId, businessDate, scope: "full"|"zone"|
  "category", status: "open"|"counting"|"committed"|"cancelled", startedAt,
  committedAt?, startedByStaffId, lines: StocktakeLine[],
  totalVarianceCents (derived) }`.
- **`StocktakeLine`** — `{ menuItemId, expectedQty (snapshot at open),
  countedQty?, secondCountQty?, varianceQty, varianceCents, countedByStaffId }`.
- **`EightySixEntry`** — manual 86 as its own record
  (`{ menuItemId, reason, by, at, reinstatedAt? }`) so "we're out" and "the keg
  blew" and "chef pulled it" are distinguishable from `inventory === 0`; ties
  into the existing `SoldOutEvent` feed rather than replacing it.
- **`ProfitTarget`** (venue config) — `{ metric: "pour-cost"|"gross-margin"|
  "labour-pct"|"comp-pct", scope: "venue"|"category", categoryId?,
  targetValue, warnAt, direction }`. Drives the alerting the review asks for.
- **`EventPnL`** — derived, not stored: an event's attributed net revenue minus
  attributed product cost, labour cost (plan 18) and `EventCost[]` (new, simple:
  `{ eventId, label, kind: "talent"|"marketing"|"production"|"other",
  amountCents }`). Closes the review's "no cost side to events".

### Behaviour

**Purchasing — `/manager/inventory` gains a Purchasing tab:**

- **Suggested order**: for the coming night's par levels, current stock, open POs
  and lead time, produce a draft PO per supplier. One tap from "we're low" to
  "order drafted". This is the feature a bar manager notices first.
- PO lifecycle: draft → submit (records who and when; sending the email is plan
  25's dispatcher, gated until then) → **receive** (partial allowed) → each
  receipt writes `restock` movements carrying `unitCostCents`, recomputes
  `avgCostCents`, and closes the line.
- **Price-change flag**: receiving at a unit cost differing from the last by more
  than a venue threshold requires acknowledgement — supplier price creep is
  invisible otherwise.
- **Reorder alerts**: a `stock-below-par` attention item on the manager Pulse,
  scoped to the *next* trading night, not to today.

**Stocktake — `/manager/inventory/stocktake`:**

- Open a stocktake (snapshots expected quantities so counting can take an hour
  without racing the night's sales), count on a phone by zone/category, optional
  blind second count for items above a value threshold, then **Commit** — a
  single consequential, audited action that writes one `adjustment` movement per
  variance line with `stocktakeId` set.
- Output: variance by item, by category and in dollars, plus **shrinkage rate**
  and the theoretical-vs-actual comparison the review names as "the report every
  bar owner runs".

**Waste — everywhere the ledger is touched:**

- A waste action on the inventory page and on the staff 86-board: item, quantity,
  reason (`spill`, `breakage`, `expired`, `comp-prep`, `training`), audited.
  Waste is costed at `avgCostCents` and reported separately from variance.

**Profitability — the payoff:**

- **Pour cost** = COGS ÷ net revenue, per item, category, zone and night.
- **Margin** on every existing revenue view: the analytics revenue cards gain a
  margin companion; `RevenueChart` gets a cost series via Recharts where it already renders
  revenue (no new charting dependency — AGENTS.md §2.4).
- **Canonical P&L formula** — the single source of truth for profitability
  math, consumed by all analytics views and the dashboard snapshot:

  ```
  netRevenue = grossRevenue - (voids + discounts)
  contribution = netRevenue - COGS - labourCost - compCost - wasteCost
  ```

  where:
  - `grossRevenue` = Σ order subtotals + auto-gratuity (before adjustments)
  - `voids` = total of void adjustments (items that never happened — stock returned)
  - `discounts` = total of discount adjustments (partial reduction — no stock return)
  - `COGS` = Σ delivered items × `avgCostCents` at delivery time
  - `labourCost` = Σ `hoursWorked × hourlyRateCents` for the business date (plan 18)
  - `compCost` = total of comp adjustments (full write-off — stock consumed, no revenue)
  - `wasteCost` = Σ waste movements × `avgCostCents`

  **Comps are subtracted once**, in the `contribution` line — never in `netRevenue`
  (they are an operational cost, not a revenue adjustment). This is the single
  formula every analytics consumer uses; changing it changes every report.
  The P&L strip renders: `netRevenue | COGS | labour | comps | waste | contribution`.
- **Full-night P&L strip** renders the canonical formula above on the dashboard
  Snapshot — the first screen in the product that answers "did we make money
  tonight".
- **Event P&L** per event, including talent and marketing costs.
- **Targets & alerts**: `ProfitTarget` breaches raise Pulse attention items and
  are available as report-engine conditions — closing the review's "no alerting
  on report thresholds".
- **Forecasting (deliberately modest)**: expected covers/revenue for an upcoming
  night from the same-weekday trailing median, shown as a band against actuals.
  No ML, no new dependency — the review asks for expected-vs-actual, not a model.

### Capability matrix additions

| Action | manager | host | bartender | runner | security | promoter |
|---|---|---|---|---|---|---|
| `purchasing:draft` | ✓ | — | ✓ | — | — | — |
| `purchasing:submit` / `:receive` | ✓ | — | — | — | — | — |
| `stocktake:count` | ✓ | ✓ | ✓ | ✓ | — | — |
| `stocktake:commit` | ✓ | — | — | — | — | — |
| `inventory:waste` | ✓ | ✓ | ✓ | — | — | — |
| `inventory:86` | ✓ | ✓ | ✓ | — | — | — |
| `cost:read` | ✓ | — | — | — | — | — |

Cost visibility is manager-only by default — supplier pricing and margins are
not floor information. `cost:read` is a matrix row so a venue can widen it.

## Implementation strategy

Demo track:

1. **Types + pure math (test-first)**: cost model, `weightedAverageCost()`,
   `computePourCost()`, `computeVariance()`, `suggestPurchaseOrder()`,
   `parForDate()`, unit conversion (`bottle` ⇄ `ml`/`oz` via `servingSize`),
   `computeEventPnL()`, forecast median band.
2. **Mock services**: `supplier-service`, `purchasing-service`,
   `stocktake-service`; `menu-service` extensions (waste, 86 entries, par
   levels, cost fields on restock).
3. **Mock data**: three suppliers with overlapping catalogues and different
   prices, a received PO history that gives every item a real `avgCostCents`, one
   open PO, one committed stocktake with realistic variance, waste events — so
   pour cost and margin render with credible numbers on first paint.
4. **UI**: Purchasing tab + PO editor + receive flow, stocktake counting flow,
   waste dialog, par/cost fields on the item editor, supplier CRUD in settings,
   margin companions across analytics, P&L strip, event costs, targets in
   settings.
5. **Pulse**: `stock-below-par`, `po-overdue`, `target-breach` attention types.
6. Report engine: new metrics + CSV sections (plan 09c's mechanism).

Live track (graduation):

7. Prisma models; movements stay INSERT-only; receiving a PO line and its
   movements and the `avgCostCents` recompute happen in **one transaction with
   the item row locked** (extends INV-O4's discipline to inbound).
8. Route handlers + Zod; domain events `PurchaseOrderSubmitted`,
   `StockReceived`, `StocktakeCommitted`, `WasteRecorded`, `TargetBreached`.
9. Analytics: SQL aggregations over movements joined to cost (AD-11); pour cost
   and margin enter the rollup table.

## Testing

- **Unit (test-first):** weighted average cost after receipts at three different
  prices, then a waste event, then a void return (plan 16) — the returned unit
  must re-enter at the cost it left at, not at the current average; pour cost
  with zero revenue; par suggestion respecting open POs and lead time; unit
  conversion round-trip for a bottle sold both by pour and whole; variance
  signs (over- and under-count); event P&L with no costs recorded.
- **Invariant canaries:** `INV-C1` `item.inventory === Σ movements.delta` still
  holds after every new movement type (extends INV-I1 to `waste`/`transfer`/
  `return`); `INV-C2` a committed stocktake writes exactly one movement per
  non-zero variance line and is never re-committed; `INV-C3` `qtyReceived ≤
  qtyOrdered` unless an over-receipt is explicitly acknowledged; `INV-C4`
  `avgCostCents` is only ever written by the receipt path.
- **Integration (live):** wrong-role 403 for `cost:read` and `stocktake:commit`;
  tenant isolation (a supplier and its prices must never appear for another
  venue); concurrent receive of the same PO line → one succeeds.
- **E2E (demo):** low stock triggers a par alert → manager drafts the suggested
  PO → submits → receives partially at a higher price → acknowledges the price
  change → pour cost on the analytics page moves → runs a stocktake, commits a
  variance → shrinkage appears → the dashboard P&L strip shows contribution for
  the night.

## Review checklist

- Does a void (plan 16) return stock at the correct historical cost rather than
  the current average? This is the one place two plans can silently disagree.
- Is `avgCostCents` ever writable from the item editor? (It must not be.)
- Do comps stay out of COGS-recovery but inside depletion, per plan 16's split?
- Is cost data excluded from every staff-facing payload, not merely hidden in
  the UI? Check the API response shapes, not the JSX.
- Does the suggested order account for already-open POs (double-ordering is the
  classic bug here)?
- Par levels indexed by day-of-week everywhere, never a single scalar?

## Exit criteria

The manager opens Inventory on a Thursday, sees what Friday needs, drafts orders
to three suppliers in a minute, and receives them Friday afternoon with the price
increase flagged. Sunday morning a stocktake commits and the venue learns its
shrinkage in dollars. And on the dashboard, every night now ends with one line
that the product could never previously produce: net revenue, minus product,
minus labour, minus comps and waste — what the club actually made.
