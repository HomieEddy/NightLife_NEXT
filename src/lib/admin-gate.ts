"use client";

/**
 * Demo lock for the platform-admin area. The live demo advertises the
 * manager/staff/guest surfaces only; /admin stays reachable by URL but asks
 * for a shared password first. sessionStorage, so it re-locks per browser
 * session. TODO(backend): replaced by real platform-admin auth (RBAC).
 */
const KEY = "nlx-admin-unlocked";

export const ADMIN_DEMO_PASSWORD = "backstage";

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(KEY) === "1";
}

export function setAdminUnlocked(value: boolean) {
  if (value) window.sessionStorage.setItem(KEY, "1");
  else window.sessionStorage.removeItem(KEY);
}
