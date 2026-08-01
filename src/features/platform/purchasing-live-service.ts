"use client";

import type { mockPurchasingService } from "@/features/platform/purchasing-mock-service";
import { liveFetch } from "@/features/shared/live-fetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function apiNoBody(path: string, init?: RequestInit): Promise<void> {
  const res = await liveFetch(path, init ?? {});
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
}

export const livePurchasingService: typeof mockPurchasingService = {
  // ── Suppliers ─────────────────────────────────────────────────
  async listSuppliers() {
    return api("/api/purchasing/suppliers");
  },

  async listSupplierItems(supplierId) {
    const qs = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : "";
    return api(`/api/purchasing/supplier-items${qs}`);
  },

  async saveSupplier(supplier) {
    return api("/api/purchasing/suppliers", { method: "POST", body: JSON.stringify(supplier) });
  },

  async saveSupplierItem(si) {
    return api("/api/purchasing/supplier-items", { method: "POST", body: JSON.stringify(si) });
  },

  async removeSupplierItem(siId) {
    await apiNoBody(`/api/purchasing/supplier-items/${encodeURIComponent(siId)}`, { method: "DELETE" });
  },

  // ── Purchase orders ───────────────────────────────────────────
  async listPurchaseOrders(supplierId) {
    const qs = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : "";
    return api(`/api/purchasing/purchase-orders${qs}`);
  },

  async savePurchaseOrder(po) {
    return api("/api/purchasing/purchase-orders", { method: "POST", body: JSON.stringify(po) });
  },

  async submitPurchaseOrder(poId, _staffId) {
    return api(`/api/purchasing/purchase-orders/${encodeURIComponent(poId)}/submit`, { method: "POST" });
  },

  async receivePurchaseOrder(poId, lines) {
    return api(`/api/purchasing/purchase-orders/${encodeURIComponent(poId)}/receive`, {
      method: "POST",
      body: JSON.stringify({ lines }),
    });
  },

  // ── Stocktakes ────────────────────────────────────────────────
  async listStocktakes() {
    return api("/api/purchasing/stocktakes");
  },

  async saveStocktake(st) {
    return api("/api/purchasing/stocktakes", { method: "POST", body: JSON.stringify(st) });
  },

  async commitStocktake(stId) {
    return api(`/api/purchasing/stocktakes/${encodeURIComponent(stId)}/commit`, { method: "POST" });
  },

  // ── 86 entries ────────────────────────────────────────────────
  async listEightySixEntries() {
    return api("/api/purchasing/eighty-six");
  },

  async eightySixItem(itemId, reason, staffId) {
    return api("/api/purchasing/eighty-six", {
      method: "POST",
      body: JSON.stringify({ itemId, reason, staffId }),
    });
  },

  // ── Waste ─────────────────────────────────────────────────────
  async recordWaste(itemId, quantity, reason, staffId) {
    return api("/api/purchasing/waste", {
      method: "POST",
      body: JSON.stringify({ itemId, quantity, reason, staffId }),
    });
  },

  // ── Profit targets ────────────────────────────────────────────
  async listProfitTargets() {
    return api("/api/purchasing/profit-targets");
  },

  async saveProfitTarget(pt) {
    return api("/api/purchasing/profit-targets", { method: "POST", body: JSON.stringify(pt) });
  },

  // ── Event costs ───────────────────────────────────────────────
  async listEventCosts(eventId) {
    const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
    return api(`/api/purchasing/event-costs${qs}`);
  },

  async saveEventCost(ec) {
    return api("/api/purchasing/event-costs", { method: "POST", body: JSON.stringify(ec) });
  },

  // ── Event run sheet ───────────────────────────────────────────
  async listEventRunSheet(eventId) {
    return api(`/api/purchasing/event-run-sheet?eventId=${encodeURIComponent(eventId)}`);
  },

  async saveEventRunSheet(eventId, entries) {
    await apiNoBody("/api/purchasing/event-run-sheet", {
      method: "POST",
      body: JSON.stringify({ eventId, entries }),
    });
  },

  // ── Supplier performance ──────────────────────────────────────
  async getSupplierPerformance(supplierId) {
    return api(`/api/purchasing/supplier-performance/${encodeURIComponent(supplierId)}`);
  },

  // ── Checklists ────────────────────────────────────────────────
  async listChecklists(type) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return api(`/api/purchasing/checklists${qs}`);
  },

  async saveChecklist(cl) {
    return api("/api/purchasing/checklists", { method: "POST", body: JSON.stringify(cl) });
  },
};
