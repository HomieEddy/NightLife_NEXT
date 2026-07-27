import type {
  Supplier,
  SupplierItem,
  PurchaseOrder,
  Stocktake,
  EightySixEntry,
  EventCost,
  ProfitTarget,
} from "@/lib/types";

export const mockSuppliers: Supplier[] = [
  {
    id: "sup-saq", venueId: "venue-1", name: "SAQ Restauration", contactName: "Pierre Lefebvre",
    email: "pierre@saq-resto.ca", phone: "+1 514 555 0201",
    leadTimeDays: 2, orderDays: [1, 2, 3, 4, 5], minimumOrderCents: 50000,
    active: true,
  },
  {
    id: "sup-diaco", venueId: "venue-1", name: "Diageo Canada", contactName: "Marie-Claude Tremblay",
    email: "mc.tremblay@diageo.com",
    leadTimeDays: 3, orderDays: [1, 3, 5], minimumOrderCents: 100000,
    active: true,
  },
  {
    id: "sup-mixos", venueId: "venue-1", name: "Mixosupply", contactName: "Alex Nguyen",
    email: "alex@mixosupply.ca",
    leadTimeDays: 1, orderDays: [1, 2, 3, 4, 5, 6],
    active: true,
  },
];

export const mockSupplierItems: SupplierItem[] = [
  { id: "si-1", supplierId: "sup-saq", menuItemId: "mi-greygoose", supplierSku: "GG-750", caseSize: 6, caseCostCents: 24000, unitCostCents: 4000, preferred: true },
  { id: "si-2", supplierId: "sup-saq", menuItemId: "mi-hennessy", supplierSku: "HN-750", caseSize: 6, caseCostCents: 33000, unitCostCents: 5500, preferred: true },
  { id: "si-3", supplierId: "sup-diaco", menuItemId: "mi-greygoose", supplierSku: "GG-D750", caseSize: 12, caseCostCents: 45600, unitCostCents: 3800, preferred: false },
  { id: "si-4", supplierId: "sup-diaco", menuItemId: "mi-don-julio", supplierSku: "DJ-750", caseSize: 6, caseCostCents: 36000, unitCostCents: 6000, preferred: true },
  { id: "si-5", supplierId: "sup-mixos", menuItemId: "mi-redbull", supplierSku: "RB-24", caseSize: 24, caseCostCents: 4800, unitCostCents: 200, preferred: true },
  { id: "si-6", supplierId: "sup-mixos", menuItemId: "mi-spring-water-12", supplierSku: "EV-24", caseSize: 24, caseCostCents: 3600, unitCostCents: 150, preferred: true },
];

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "po-1", venueId: "venue-1", supplierId: "sup-saq", code: "PO-2026-0725",
    status: "received",
    expectedAt: "2026-07-24T15:00:00-04:00",
    submittedAt: "2026-07-23T10:00:00-04:00",
    submittedByStaffId: "st-amara",
    lines: [
      { id: "pol-1", menuItemId: "mi-greygoose", qtyOrdered: 12, qtyReceived: 12, unitCostCents: 4000, lineTotalCents: 48000 },
      { id: "pol-2", menuItemId: "mi-hennessy", qtyOrdered: 6, qtyReceived: 6, unitCostCents: 5500, lineTotalCents: 33000 },
    ],
    subtotalCents: 81000,
    notes: "Friday restock",
  },
  {
    id: "po-2", venueId: "venue-1", supplierId: "sup-diaco", code: "PO-2026-0726",
    status: "submitted",
    expectedAt: "2026-07-25T15:00:00-04:00",
    submittedAt: "2026-07-24T16:00:00-04:00",
    submittedByStaffId: "st-amara",
    lines: [
      { id: "pol-3", menuItemId: "mi-don-julio", qtyOrdered: 6, qtyReceived: 0, unitCostCents: 6000, lineTotalCents: 36000 },
    ],
    subtotalCents: 36000,
  },
];

export const mockStocktakes: Stocktake[] = [
  {
    id: "st-1", venueId: "venue-1", businessDate: "2026-07-24",
    scope: "full", status: "committed",
    startedAt: "2026-07-25T04:30:00-04:00",
    committedAt: "2026-07-25T05:15:00-04:00",
    startedByStaffId: "st-sofia",
    lines: [
      { id: "stl-1", menuItemId: "mi-greygoose", expectedQty: 5, countedQty: 4, varianceQty: -1, varianceCents: -4000 },
      { id: "stl-2", menuItemId: "mi-hennessy", expectedQty: 3, countedQty: 3, varianceQty: 0, varianceCents: 0 },
    ],
    totalVarianceCents: -4000,
  },
];

export const mockEightySixEntries: EightySixEntry[] = [
  { id: "86-1", menuItemId: "mi-ace", reason: "Sold out — last bottle sold at 01:30", byStaffId: "st-sofia", at: "2026-07-25T01:30:00-04:00" },
];

export const mockProfitTargets: ProfitTarget[] = [
  { id: "pt-1", venueId: "venue-1", metric: "pour-cost", scope: "venue", targetValue: 0.22, warnAt: 0.25, direction: "above" },
  { id: "pt-2", venueId: "venue-1", metric: "gross-margin", scope: "venue", targetValue: 0.65, warnAt: 0.60, direction: "below" },
];

export const mockEventCosts: EventCost[] = [
  { id: "ec-1", eventId: "evt-1", label: "Headliner DJ fee", kind: "talent", amountCents: 200000 },
  { id: "ec-2", eventId: "evt-1", label: "Instagram ads", kind: "marketing", amountCents: 35000 },
];
