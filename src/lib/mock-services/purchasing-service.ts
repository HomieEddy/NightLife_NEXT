/**
 * mockPurchasingService — future backend boundary for purchasing, stocktaking
 * and cost data (plan 19). Purchase orders are mutable until submitted;
 * stocktakes are immutable after committed.
 */
import type { PurchaseOrder, Stocktake, Supplier, SupplierItem, StockMovement, EightySixEntry, ProfitTarget, EventCost } from "@/lib/types";
import { mockSuppliers, mockSupplierItems, mockPurchaseOrders, mockStocktakes, mockEightySixEntries, mockProfitTargets, mockEventCosts } from "@/lib/mock-data/costs";
import { mockMenuItems, mockStockMovements } from "@/lib/mock-data/menu";
import { clone, delay, uid } from "./delay";

const suppliers: Supplier[] = clone(mockSuppliers);
const supplierItems: SupplierItem[] = clone(mockSupplierItems);
const purchaseOrders: PurchaseOrder[] = clone(mockPurchaseOrders);
const stocktakes: Stocktake[] = clone(mockStocktakes);
const eightySixEntries: EightySixEntry[] = clone(mockEightySixEntries);

export const mockPurchasingService = {
  // Suppliers
  async listSuppliers(): Promise<Supplier[]> {
    await delay();
    return clone(suppliers);
  },

  async listSupplierItems(supplierId?: string): Promise<SupplierItem[]> {
    await delay();
    if (supplierId) return clone(supplierItems.filter((si) => si.supplierId === supplierId));
    return clone(supplierItems);
  },

  async saveSupplier(supplier: Supplier): Promise<Supplier> {
    await delay(300);
    const idx = suppliers.findIndex((s) => s.id === supplier.id);
    if (idx >= 0) suppliers[idx] = clone(supplier);
    else suppliers.push(clone(supplier));
    return clone(supplier);
  },

  // Purchase orders
  async listPurchaseOrders(supplierId?: string): Promise<PurchaseOrder[]> {
    await delay();
    if (supplierId) return clone(purchaseOrders.filter((po) => po.supplierId === supplierId));
    return clone(purchaseOrders);
  },

  async savePurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder> {
    await delay(300);
    const idx = purchaseOrders.findIndex((p) => p.id === po.id);
    if (idx >= 0) purchaseOrders[idx] = clone(po);
    else purchaseOrders.push(clone(po));
    return clone(po);
  },

  async submitPurchaseOrder(poId: string, staffId: string): Promise<PurchaseOrder> {
    await delay(300);
    const idx = purchaseOrders.findIndex((p) => p.id === poId);
    if (idx === -1) throw new Error("PO not found.");
    if (purchaseOrders[idx].status !== "draft") throw new Error("Only draft POs can be submitted.");
    purchaseOrders[idx] = {
      ...purchaseOrders[idx],
      status: "submitted",
      submittedAt: new Date().toISOString(),
      submittedByStaffId: staffId,
    };
    return clone(purchaseOrders[idx]);
  },

  async receivePurchaseOrder(poId: string, lines: { lineId: string; qtyReceived: number }[]): Promise<PurchaseOrder> {
    await delay(300);
    const idx = purchaseOrders.findIndex((p) => p.id === poId);
    if (idx === -1) throw new Error("PO not found.");
    const po = { ...purchaseOrders[idx] };
    for (const r of lines) {
      const line = po.lines.find((l) => l.id === r.lineId);
      if (!line) continue;
      line.qtyReceived += r.qtyReceived;
      if (line.qtyReceived > line.qtyOrdered) throw new Error(`Over-receipt on line ${r.lineId}`);

      // Bump inventory + log restock movement (plan 19)
      const item = mockMenuItems.find((mi) => mi.id === line.menuItemId);
      if (item && r.qtyReceived > 0) {
        item.inventory += r.qtyReceived;
        mockStockMovements.unshift({
          id: uid("mv"),
          menuItemId: line.menuItemId,
          itemName: item.name,
          type: "restock",
          delta: r.qtyReceived,
          note: `Received PO ${po.code}`,
          createdAt: new Date().toISOString(),
          unitCostCents: line.unitCostCents,
          purchaseOrderId: po.id,
        });
      }
    }
    const allReceived = po.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
    po.status = allReceived ? "received" : "partially-received";
    purchaseOrders[idx] = po;
    return clone(po);
  },

  // Stocktakes
  async listStocktakes(): Promise<Stocktake[]> {
    await delay();
    return clone(stocktakes);
  },

  async saveStocktake(st: Stocktake): Promise<Stocktake> {
    await delay(300);
    const idx = stocktakes.findIndex((s) => s.id === st.id);
    if (idx >= 0) stocktakes[idx] = clone(st);
    else stocktakes.push(clone(st));
    return clone(st);
  },

  async commitStocktake(stId: string): Promise<Stocktake> {
    await delay(300);
    const idx = stocktakes.findIndex((s) => s.id === stId);
    if (idx === -1) throw new Error("Stocktake not found.");
    stocktakes[idx] = {
      ...stocktakes[idx],
      status: "committed",
      committedAt: new Date().toISOString(),
    };
    return clone(stocktakes[idx]);
  },

  // 86 entries
  async listEightySixEntries(): Promise<EightySixEntry[]> {
    await delay();
    return clone(eightySixEntries);
  },

  async eightySixItem(itemId: string, reason: string, staffId: string): Promise<EightySixEntry> {
    await delay(200);
    const e: EightySixEntry = {
      id: uid("86"),
      menuItemId: itemId,
      reason,
      byStaffId: staffId,
      at: new Date().toISOString(),
    };
    eightySixEntries.push(e);
    return clone(e);
  },

  // Waste
  async recordWaste(movement: StockMovement): Promise<StockMovement> {
    await delay(200);
    return clone(movement);
  },

  // Profit targets
  async listProfitTargets(): Promise<ProfitTarget[]> {
    await delay();
    return clone(mockProfitTargets);
  },

  async saveProfitTarget(pt: ProfitTarget): Promise<ProfitTarget> {
    await delay(200);
    return clone(pt);
  },

  // Event costs
  async listEventCosts(eventId?: string): Promise<EventCost[]> {
    await delay();
    if (eventId) return clone(mockEventCosts.filter((ec) => ec.eventId === eventId));
    return clone(mockEventCosts);
  },

  async saveEventCost(ec: EventCost): Promise<EventCost> {
    await delay(200);
    return clone(ec);
  },
};
