"use client";

import { liveFetch } from "@/features/shared/live-fetch";
import type { RolePermissions } from "@/features/shared/permissions";

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

export const livePermissionService = {
  async getRolePermissions(_venueId: string): Promise<RolePermissions> {
    return api<RolePermissions>("/api/permissions");
  },

  async setRolePermissions(_venueId: string, permissions: RolePermissions): Promise<void> {
    await api<RolePermissions>("/api/permissions", {
      method: "PUT",
      body: JSON.stringify(permissions),
    });
  },

  async resetRolePermissions(_venueId: string): Promise<void> {
    await api<RolePermissions>("/api/permissions", { method: "DELETE" });
  },
};
