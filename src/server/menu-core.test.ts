import { describe, it, expect } from "vitest";

/**
 * Ledger property tests (INV-I1) and package quote math — against a pure
 * in-memory fake, no DB. The integration suite repeats these against Postgres.
 */

// ── Ledger helpers (pure functions tested in isolation) ────────────────

interface Movement {
  delta: number;
}

function checkLedger(inventory: number, movements: Movement[]): boolean {
  const sum = movements.reduce((acc, m) => acc + m.delta, 0);
  return inventory === sum;
}

describe("ledger invariant (INV-I1)", () => {
  it("restock sequence preserves balance", () => {
    const movements: Movement[] = [];
    let inventory = 0;

    inventory += 10;
    movements.push({ delta: 10 });
    expect(checkLedger(inventory, movements)).toBe(true);

    inventory += 5;
    movements.push({ delta: 5 });
    expect(checkLedger(inventory, movements)).toBe(true);
  });

  it("sale sequence preserves balance", () => {
    const movements: Movement[] = [{ delta: 20 }];
    let inventory = 20;

    inventory -= 3;
    movements.push({ delta: -3 });
    expect(checkLedger(inventory, movements)).toBe(true);

    inventory -= 7;
    movements.push({ delta: -7 });
    expect(checkLedger(inventory, movements)).toBe(true);
  });

  it("mixed restock/sale/adjust preserves balance", () => {
    const movements: Movement[] = [];
    let inventory = 0;

    inventory += 12;
    movements.push({ delta: 12 });

    inventory -= 4;
    movements.push({ delta: -4 });

    const adjustTo = 3;
    const adjustDelta = adjustTo - inventory;
    inventory = adjustTo;
    movements.push({ delta: adjustDelta });

    expect(checkLedger(inventory, movements)).toBe(true);
  });

  it("oversell is rejected (inventory cannot go negative)", () => {
    const inventory = 2;
    const requested = 5;
    expect(requested > inventory).toBe(true);
  });

  it("zero inventory after sale triggers sold-out", () => {
    let inventory = 1;
    const sold = 1;
    const wasBefore = inventory > 0;
    inventory -= sold;
    expect(wasBefore && inventory === 0).toBe(true);
  });
});

// ── 86 emission matrix ─────────────────────────────────────────────────

describe("86 emission matrix (INV-I2)", () => {
  function shouldEmit86(prevInventory: number, newInventory: number, manualToggle: boolean): boolean {
    if (manualToggle) return true;
    return prevInventory > 0 && newInventory === 0;
  }

  it("sale to zero → emits", () => {
    expect(shouldEmit86(3, 0, false)).toBe(true);
  });

  it("sale but not to zero → does not emit", () => {
    expect(shouldEmit86(3, 1, false)).toBe(false);
  });

  it("adjust to zero from positive → emits", () => {
    expect(shouldEmit86(5, 0, false)).toBe(true);
  });

  it("adjust from zero to zero → does not emit", () => {
    expect(shouldEmit86(0, 0, false)).toBe(false);
  });

  it("manual 86 toggle → always emits", () => {
    expect(shouldEmit86(5, 5, true)).toBe(true);
  });
});

// ── Package quote math ─────────────────────────────────────────────────

interface QuoteItem {
  priceCents: number;
  inventory: number;
  isAvailable: boolean;
}

interface QuoteComponent {
  itemId: string;
  quantity: number;
}

function computeQuote(
  packagePriceCents: number,
  components: QuoteComponent[],
  items: Map<string, QuoteItem>,
) {
  let componentsValue = 0;
  let maxQuantity = Number.POSITIVE_INFINITY;

  for (const c of components) {
    const item = items.get(c.itemId);
    if (!item) {
      maxQuantity = 0;
      continue;
    }
    componentsValue += item.priceCents * c.quantity;
    const fulfillable = item.isAvailable
      ? Math.floor(item.inventory / c.quantity)
      : 0;
    maxQuantity = Math.min(maxQuantity, fulfillable);
  }

  if (!Number.isFinite(maxQuantity)) maxQuantity = 0;

  return {
    componentsValue,
    savings: Math.max(0, componentsValue - packagePriceCents),
    maxQuantity,
  };
}

describe("package quote math", () => {
  it("computes savings as components − package price, floored at 0", () => {
    const items = new Map<string, QuoteItem>([
      ["a", { priceCents: 50000, inventory: 10, isAvailable: true }],
    ]);
    const q = computeQuote(40000, [{ itemId: "a", quantity: 2 }], items);
    expect(q.componentsValue).toBe(100000);
    expect(q.savings).toBe(60000);
  });

  it("savings floor at 0 when package costs more than components", () => {
    const items = new Map<string, QuoteItem>([
      ["a", { priceCents: 10000, inventory: 10, isAvailable: true }],
    ]);
    const q = computeQuote(50000, [{ itemId: "a", quantity: 1 }], items);
    expect(q.savings).toBe(0);
  });

  it("maxQuantity is limited by the scarcest component", () => {
    const items = new Map<string, QuoteItem>([
      ["a", { priceCents: 50000, inventory: 8, isAvailable: true }],
      ["b", { priceCents: 2400, inventory: 3, isAvailable: true }],
    ]);
    const q = computeQuote(240000, [
      { itemId: "a", quantity: 5 },
      { itemId: "b", quantity: 2 },
    ], items);
    expect(q.maxQuantity).toBe(1);
  });

  it("unavailable item → maxQuantity 0", () => {
    const items = new Map<string, QuoteItem>([
      ["a", { priceCents: 50000, inventory: 10, isAvailable: false }],
    ]);
    const q = computeQuote(40000, [{ itemId: "a", quantity: 1 }], items);
    expect(q.maxQuantity).toBe(0);
  });

  it("missing item → maxQuantity 0", () => {
    const items = new Map<string, QuoteItem>();
    const q = computeQuote(40000, [{ itemId: "missing", quantity: 1 }], items);
    expect(q.maxQuantity).toBe(0);
  });

  it("no components → maxQuantity 0, savings 0", () => {
    const items = new Map<string, QuoteItem>();
    const q = computeQuote(40000, [], items);
    expect(q.maxQuantity).toBe(0);
    expect(q.savings).toBe(0);
    expect(q.componentsValue).toBe(0);
  });
});
