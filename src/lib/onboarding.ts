"use client";

/**
 * First-run gate for the manager demo. Stored in localStorage so the
 * onboarding shows once per browser, surviving reloads of the mock services.
 */
const KEY = "nlx-manager-onboarded";

export function isManagerOnboarded(): boolean {
  if (typeof window === "undefined") return true; // never gate during SSR
  return window.localStorage.getItem(KEY) === "1";
}

export function setManagerOnboarded(value: boolean) {
  if (value) window.localStorage.setItem(KEY, "1");
  else window.localStorage.removeItem(KEY);
}
