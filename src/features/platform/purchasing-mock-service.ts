/**
 * mockPurchasingService — future backend boundary for purchasing, stocktaking
 * and cost data (plan 19). Purchase orders are mutable until submitted;
 * stocktakes are immutable after committed.
 */
import type { PurchaseOrder, Stocktake, Supplier, SupplierItem, StockMovement, EightySixEntry, ProfitTarget, EventCost, EventRunSheetEntry, InventoryChecklist, InventoryChecklistEntry, SupplierPerformanceMetrics } from "@/lib/types";
import { mockSuppliers, mockSupplierItems, mockPurchaseOrders, mockStocktakes, mockEightySixEntries, mockProfitTargets, mockEventCosts } from "@/features/ordering/costs-mock-data";
import { mockMenuItems, mockStockMovements } from "@/features/menu/mock-data";
import { clone, delay, uid } from "@/features/shared/delay";

const suppliers: Supplier[] = clone(mockSuppliers);
const supplierItems: SupplierItem[] = clone(mockSupplierItems);
const purchaseOrders: PurchaseOrder[] = clone(mockPurchaseOrders);
const stocktakes: Stocktake[] = clone(mockStocktakes);
const eightySixEntries: EightySixEntry[] = clone(mockEightySixEntries);
const runSheets: Record<string, EventRunSheetEntry[]> = {};
const supplierMetrics: Record<string, SupplierPerformanceMetrics> = {};
const checklists: InventoryChecklist[] = [];

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

  async saveSupplierItem(si: SupplierItem): Promise<SupplierItem> {
    await delay(200);
    const idx = supplierItems.findIndex((s) => s.id === si.id);
    if (idx >= 0) supplierItems[idx] = clone(si);
    else supplierItems.push(clone(si));
    return clone(si);
  },

  async removeSupplierItem(siId: string): Promise<void> {
    await delay(150);
    const idx = supplierItems.findIndex((s) => s.id === siId);
    if (idx >= 0) supplierItems.splice(idx, 1);
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
  async recordWaste(itemId: string, quantity: number, reason: string, staffId: string): Promise<StockMovement> {
    await delay(200);
    const item = mockMenuItems.find((i) => i.id === itemId);
    const label = item?.name ?? itemId;
    const movement: StockMovement = {
      id: uid("waste"),
      menuItemId: itemId,
      itemName: label,
      type: "waste",
      delta: -Math.abs(quantity),
      note: reason,
      wasteReason: reason,
      createdAt: new Date().toISOString(),
    };
    if (item) item.inventory = Math.max(0, item.inventory - Math.abs(quantity));
    mockStockMovements.push(movement);
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

  /** OE-19: Event run sheet — timeline entries for a night's event. */
  async listEventRunSheet(eventId: string): Promise<EventRunSheetEntry[]> {
    await delay();
    return clone(runSheets[eventId] ?? []);
  },

  async saveEventRunSheet(eventId: string, entries: EventRunSheetEntry[]): Promise<void> {
    await delay(200);
    runSheets[eventId] = clone(entries);
  },

  /** OE-33: Supplier performance metrics. */
  async getSupplierPerformance(supplierId: string): Promise<SupplierPerformanceMetrics | null> {
    await delay();
    return clone(supplierMetrics[supplierId] ?? null);
  },

  /** OE-35: Inventory checklists — pre-service or post-service. */
  async listChecklists(type?: InventoryChecklist["type"]): Promise<InventoryChecklist[]> {
    await delay();
    return clone(type ? checklists.filter((c) => c.type === type) : checklists);
  },

  async saveChecklist(cl: InventoryChecklist): Promise<InventoryChecklist> {
    await delay(200);
    const idx = checklists.findIndex((c) => c.id === cl.id);
    if (idx >= 0) checklists[idx] = clone(cl);
    else checklists.push(clone(cl));
    return clone(cl);
  },
};
