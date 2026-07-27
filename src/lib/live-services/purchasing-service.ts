"use client";

import type { mockPurchasingService } from "@/lib/mock-services/purchasing-service";

function notYetSupported(): never {
  throw new Error("Purchasing/cost features are not yet supported in the live build — see docs/plans/19-cost-supply-profitability-PLAN.md");
}

export const livePurchasingService: typeof mockPurchasingService = {
  listSuppliers: notYetSupported,
  listSupplierItems: notYetSupported,
  saveSupplier: notYetSupported,
  listPurchaseOrders: notYetSupported,
  savePurchaseOrder: notYetSupported,
  submitPurchaseOrder: notYetSupported,
  receivePurchaseOrder: notYetSupported,
  listStocktakes: notYetSupported,
  saveStocktake: notYetSupported,
  commitStocktake: notYetSupported,
  listEightySixEntries: notYetSupported,
  eightySixItem: notYetSupported,
  recordWaste: notYetSupported,
  listProfitTargets: notYetSupported,
  saveProfitTarget: notYetSupported,
  listEventCosts: notYetSupported,
  saveEventCost: notYetSupported,
};
