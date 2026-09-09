import { describe, expect, test } from "vitest";
import { suggestPurchaseOrder } from "./costs";
import type { MenuItem, PurchaseOrder, SupplierItem } from "@/lib/types";

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
