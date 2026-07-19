# 04 — Menu, Inventory & Packages · PLAN

**Status: complete.**

Goal: the catalog context with its **append-only stock ledger** — the first plan
with a real invariant (INV-I1) and therefore the first tests-before-code plan.

Preconditions: plan 03.

## Reasoning

Inventory is "ledger semantics" in AGENTS.md §9.4 — harder than CRUD, easier than
money-in-transactions. Doing it before orders means plan 05's order transaction can
call a proven `recordSale`. The 86-board event feed also originates here.

## Design choices

- **Schema**: `MenuCategory`, `MenuItem` (priceCents, isAvailable, `inventory Int`
  as the *cached* running balance), `ModifierGroup`/`ModifierOption`,
  `BottlePackage` + `PackageComponent`, `HappyHourRule`, `StockMovement`
  (append-only, `itemName` snapshot kept per DDD §4), `SoldOutEvent`.
- **Ledger discipline (INV-I1)**: every inventory change = one movement row + the
  cached balance updated **in the same transaction**. A `checkLedger(itemId)`
  test helper asserts `inventory === Σ delta`; integration suites call it after
  every mutation. Movements table gets no UPDATE/DELETE in prod (DDD §6).
- **`recordSale` becomes transactional with row locks** (menu-service TODO):
  `SELECT … FOR UPDATE` on the item rows, oversell rejected server-side (the mock
  silently clamped — behavior change, surfaced to the guest as "not enough stock",
  documented in the PR).
- **86 events** (INV-I2): emitted inside the same transactions (sale-to-zero,
  manual 86, adjust-to-zero); also published as `SoldOut` domain events — consumed
  live in plan 07, polled until then.
- **Package quotes stay derived**: `quoteFor` logic moves server-side unchanged;
  never stored (DDD).
- **Item deletion guard** (inventory-page TODO / INV-I3): active-package reference
  → 409 with the package names; UI already has the confirm dialog to show it.
- **Happy hour**: CRUD here; **pricing application deferred to plan 05** where the
  order pricing engine lives — noted so nobody wires it twice.

## Implementation strategy

1. Tests first: ledger property tests (unit, against a fake store) — restock/
   sale/adjust sequences preserve INV-I1; oversell rejected; 86 emission matrix.
2. Schema + migration + seeds (mock menu literals → cents).
3. Handlers + body swaps in dependency order: categories → items → movements
   (restock/bulkRestock/adjust) → recordSale → packages → happy-hour CRUD →
   soldOutEvents.
4. Rename to `menuService`; delete consumed TODOs (3 in menu-service, menu/
   inventory page TODOs).

## Testing

- Unit: ledger properties (above); package quote math (maxQuantity across
  components, savings floor at 0).
- Integration: every mutation + `checkLedger`; concurrent `recordSale` on the same
  item (two parallel transactions) never oversells — the row-lock proof; tenant
  isolation; INV-I3 409.
- E2E: manager 86s a bottle → staff home 86-board shows it (still via poll).

## Review checklist

- Any code path that writes `inventory` without a movement row?
- Does bulk restock produce one movement per line (not one lump)?
- Is the oversell UX change reflected in the guest cart error handling?

## Exit criteria

`menuService` real; inventory page's movement log shows DB rows; ledger canary
green under concurrency; 86-board fed by `sold_out_events` table.
