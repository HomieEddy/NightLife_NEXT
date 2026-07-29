"use client";

import type {
  BottlePackage,
  HappyHourRule,
  MenuCategory,
  MenuItem,
  PackageQuote,
  SoldOutEvent,
  StockMovement,
} from "@/lib/types";

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

export const liveMenuService = {
  async listCategories(includeInactive = false): Promise<MenuCategory[]> {
    const qs = includeInactive ? "?includeInactive=true" : "";
    return api<MenuCategory[]>(`/api/menu/categories${qs}`);
  },

  async createCategory(input: Omit<MenuCategory, "id">): Promise<MenuCategory> {
    return api<MenuCategory>("/api/menu/categories", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateCategory(
    categoryId: string,
    patch: Partial<Omit<MenuCategory, "id" | "venueId">>,
  ): Promise<MenuCategory | null> {
    return api<MenuCategory | null>(`/api/menu/categories/${encodeURIComponent(categoryId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/menu/categories/${encodeURIComponent(categoryId)}`, {
      method: "DELETE",
    });
  },

  async listItems(categoryId?: string): Promise<MenuItem[]> {
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return api<MenuItem[]>(`/api/menu/items${qs}`);
  },

  async listItemsByAllergenExclusion(exclude: string[], categoryId?: string): Promise<MenuItem[]> {
    const params = new URLSearchParams();
    for (const a of exclude) params.append("excludeAllergen", a);
    if (categoryId) params.set("categoryId", categoryId);
    return api<MenuItem[]>(`/api/menu/items/allergen-filter?${params}`);
  },

  async getItem(itemId: string): Promise<MenuItem | null> {
    const res = await liveFetch(`/api/menu/items/${encodeURIComponent(itemId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get item ${itemId}`);
    return res.json();
  },

  async updateItem(itemId: string, patch: Partial<Omit<MenuItem, "id">>): Promise<MenuItem | null> {
    return api<MenuItem | null>(`/api/menu/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async createItem(input: Omit<MenuItem, "id">): Promise<MenuItem> {
    return api<MenuItem>("/api/menu/items", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async deleteItem(itemId: string): Promise<void> {
    const res = await liveFetch(`/api/menu/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? "Delete failed");
    }
  },

  async toggleCategory(categoryId: string): Promise<MenuCategory | null> {
    return api<MenuCategory | null>(`/api/menu/categories/${encodeURIComponent(categoryId)}`, {
      method: "POST",
    });
  },

  // ── Packages ──────────────────────────────────────────────────────

  async listPackages(includeInactive = false): Promise<(BottlePackage & { quote: PackageQuote })[]> {
    const qs = includeInactive ? "?includeInactive=true" : "";
    return api<(BottlePackage & { quote: PackageQuote })[]>(`/api/menu/packages${qs}`);
  },

  async getPackage(packageId: string): Promise<(BottlePackage & { quote: PackageQuote }) | null> {
    const res = await liveFetch(`/api/menu/packages/${encodeURIComponent(packageId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get package ${packageId}`);
    return res.json();
  },

  async createPackage(input: Omit<BottlePackage, "id">): Promise<BottlePackage> {
    return api<BottlePackage>("/api/menu/packages", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updatePackage(
    packageId: string,
    patch: Partial<Omit<BottlePackage, "id">>,
  ): Promise<BottlePackage | null> {
    return api<BottlePackage | null>(`/api/menu/packages/${encodeURIComponent(packageId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deletePackage(packageId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/menu/packages/${encodeURIComponent(packageId)}`, {
      method: "DELETE",
    });
  },

  // ── Inventory ─────────────────────────────────────────────────────

  async listMovements(limit = 25): Promise<StockMovement[]> {
    return api<StockMovement[]>(`/api/menu/movements?limit=${limit}`);
  },

  async restockItem(itemId: string, quantity: number, note?: string): Promise<MenuItem | null> {
    return api<MenuItem | null>(`/api/menu/items/${encodeURIComponent(itemId)}/restock`, {
      method: "POST",
      body: JSON.stringify({ quantity, note }),
    });
  },

  async bulkRestock(
    lines: { itemId: string; quantity: number }[],
    note?: string,
  ): Promise<number> {
    const result = await api<{ applied: number }>("/api/menu/items/bulk-restock", {
      method: "POST",
      body: JSON.stringify({ lines, note }),
    });
    return result.applied;
  },

  async adjustInventory(itemId: string, newCount: number, note?: string): Promise<MenuItem | null> {
    return api<MenuItem | null>(`/api/menu/items/${encodeURIComponent(itemId)}/adjust`, {
      method: "POST",
      body: JSON.stringify({ newCount, note }),
    });
  },

  async recordSale(lines: { menuItemId: string; quantity: number }[]): Promise<void> {
    const result = await api<{ ok: boolean; error?: string }>("/api/menu/items/record-sale", {
      method: "POST",
      body: JSON.stringify({ lines }),
    });
    if (!result.ok) throw new Error(result.error ?? "Sale rejected");
  },

  async listSoldOutEvents(withinMinutes = 30): Promise<SoldOutEvent[]> {
    return api<SoldOutEvent[]>(`/api/menu/sold-out-events?withinMinutes=${withinMinutes}`);
  },

  // ── Happy hour ────────────────────────────────────────────────────

  async listHappyHourRules(): Promise<HappyHourRule[]> {
    return api<HappyHourRule[]>("/api/menu/happy-hours");
  },

  async toggleHappyHourRule(ruleId: string): Promise<HappyHourRule | null> {
    return api<HappyHourRule | null>(`/api/menu/happy-hours/${encodeURIComponent(ruleId)}`, {
      method: "POST",
    });
  },

  async createHappyHourRule(input: Omit<HappyHourRule, "id" | "venueId">): Promise<HappyHourRule> {
    return api<HappyHourRule>("/api/menu/happy-hours", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateHappyHourRule(
    ruleId: string,
    patch: Partial<Omit<HappyHourRule, "id" | "venueId">>,
  ): Promise<HappyHourRule | null> {
    return api<HappyHourRule | null>(`/api/menu/happy-hours/${encodeURIComponent(ruleId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteHappyHourRule(ruleId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/menu/happy-hours/${encodeURIComponent(ruleId)}`, {
      method: "DELETE",
    });
  },
};
import { liveFetch } from "./live-fetch";
