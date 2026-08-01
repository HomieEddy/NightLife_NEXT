"use client";

/** Keyboard shortcuts for the manager shell — one registry consumed by the keydown handler and the ? help sheet. */
export interface Shortcut {
  keys: string;
  label: string;
  /** If truthy, fires unconditionally (global). If false, only when no dialog/sheet is open. */
  global?: boolean;
}

export const MANAGER_SHORTCUTS: Shortcut[] = [
  { keys: "⌘K", label: "Command palette — search orders, tables, pages, and actions", global: true },
  { keys: "/", label: "Focus the current page's search input" },
  { keys: "?", label: "Show this shortcut list", global: true },
  { keys: "g d", label: "Jump to Dashboard" },
  { keys: "g o", label: "Jump to Orders" },
  { keys: "g f", label: "Jump to Floor map" },
  { keys: "g m", label: "Jump to Menu" },
  { keys: "g i", label: "Jump to Inventory" },
  { keys: "g b", label: "Jump to Bookings / Reservations" },
  { keys: "g t", label: "Jump to Team / Staff" },
  { keys: "g s", label: "Jump to Settings" },
  { keys: "Esc", label: "Close any open dialog or sheet" },
];

/** Map of group jump letters to nav hrefs. */
export const GROUP_JUMPS: Record<string, string> = {
  d: "/manager",
  o: "/manager/orders",
  f: "/manager/floor-map",
  m: "/manager/menu",
  i: "/manager/inventory",
  b: "/manager/reservations",
  t: "/manager/staff",
  s: "/manager/settings",
};
