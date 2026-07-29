import { describe, expect, test } from "vitest";
import {
  weightedAverageCost,
  computePourCost,
  computeEventPnL,
  suggestPurchaseOrder,
} from "./costs";
import type { MenuItem, PurchaseOrder, StockMovement, SupplierItem } from "@/lib/types";

describe("weightedAverageCost", () => {
  test("computes WAC from two restocks at different prices", () => {
    const movements: StockMovement[] = [
      { id: "m1", menuItemId: "i1", itemName: "Grey Goose", type: "restock", delta: 10, unitCostCents: 3000, createdAt: "" },
      { id: "m2", menuItemId: "i1", itemName: "Grey Goose", type: "restock", delta: 10, unitCostCents: 4000, createdAt: "" },
    ];
    expect(weightedAverageCost("i1", movements)).toBe(3500); // (10×3000 + 10×4000)/20
  });

  test("returns 0 when no restocks exist", () => {
    expect(weightedAverageCost("no-item", [])).toBe(0);
  });

  test("ignores non-restock and negative-delta movements", () => {
    const movements: StockMovement[] = [
      { id: "m1", menuItemId: "i1", itemName: "", type: "restock", delta: 5, unitCostCents: 2000, createdAt: "" },
      { id: "m2", menuItemId: "i1", itemName: "", type: "sale", delta: -3, unitCostCents: 2000, createdAt: "" },
    ];
    expect(weightedAverageCost("i1", movements)).toBe(2000);
  });
});

describe("computePourCost", () => {
  test("22% pour cost on $1000 revenue", () => {
    const items = [
      { menuItemId: "i1", quantity: 5, avgCostCents: 3000 }, // $150 COGS
      { menuItemId: "i2", quantity: 10, avgCostCents: 700 },  // $70 COGS
    ];
    // COGS = $220 on $1000 revenue = 22%
    expect(computePourCost(100000, items)).toBeCloseTo(0.22, 4);
  });

  test("returns 0 when revenue is 0", () => {
    expect(computePourCost(0, [{ menuItemId: "i1", quantity: 5, avgCostCents: 3000 }])).toBe(0);
  });
});

describe("computeEventPnL", () => {
  test("contribution = revenue - all costs", () => {
    const pnl = computeEventPnL("e1", "Friday Night", 500000, 110000, 80000, [
      { id: "ec1", eventId: "e1", label: "DJ Fee", kind: "talent", amountCents: 150000 },
    ]);
    expect(pnl.contribution).toBe(160000); // 500000 - 110000 - 80000 - 150000
  });

  test("no event costs still produces valid PnL", () => {
    const pnl = computeEventPnL("e2", "Quiet Night", 200000, 40000, 30000, []);
    expect(pnl.contribution).toBe(130000);
  });
});

describe("suggestPurchaseOrder", () => {
  const items: MenuItem[] = [
    {
      id: "i1", categoryId: "c1", name: "Grey Goose", description: "", price: 45000,
      icon: "vodka", tags: ["premium"], isAvailable: true, inventory: 3,
      isAlcoholic: true, allergens: [],
      parLevels: { 5: 10 }, // Friday par: 10 bottles
    },
    {
      id: "i2", categoryId: "c1", name: "Patron", description: "", price: 42000,
      icon: "tequila", tags: ["premium"], isAvailable: true, inventory: 8,
      isAlcoholic: true, allergens: [],
      // No par level configured — skipped
    },
  ];

  test("suggests qty when inventory below par", () => {
    const openPos: PurchaseOrder[] = [];
    const supplierItems: SupplierItem[] = [
      { id: "si1", supplierId: "sup1", menuItemId: "i1", unitCostCents: 3000, preferred: true },
    ];
    const result = suggestPurchaseOrder(items, openPos, 5, supplierItems, "sup1");
    expect(result).toHaveLength(1);
    expect(result[0].menuItemId).toBe("i1");
    expect(result[0].suggestedQty).toBe(7); // 10 - 3 - 0
    expect(result[0].unitCostCents).toBe(3000);
  });

  test("deducts open PO quantities from needed", () => {
    const openPos: PurchaseOrder[] = [
      {
        id: "po1", venueId: "v", supplierId: "sup1", code: "PO-1", status: "submitted",
        lines: [{ id: "pl1", menuItemId: "i1", qtyOrdered: 5, qtyReceived: 2, unitCostCents: 3000, lineTotalCents: 15000 }],
        subtotalCents: 15000,
      },
    ];
    const supplierItems: SupplierItem[] = [
      { id: "si1", supplierId: "sup1", menuItemId: "i1", unitCostCents: 3000, preferred: true },
    ];
    const result = suggestPurchaseOrder(items, openPos, 5, supplierItems, "sup1");
    // par 10 - inventory 3 - (qtyOrdered 5 - qtyReceived 2 = 3) = 4
    expect(result[0].suggestedQty).toBe(4);
  });

  test("skips items without par levels", () => {
    const result = suggestPurchaseOrder(items, [], 5, [], "sup1");
    expect(result).toHaveLength(1); // only i1, not i2
  });
});
