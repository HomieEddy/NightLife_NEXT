/**
 * Pure door/guest-identity math (plan 17) — occupancy, waitlist position,
 * profile dedupe, no-show gating, responsible-service drink counting.
 * No I/O: every input is already fetched by the caller (mock-services),
 * so this is directly unit-testable, same convention as src/lib/tab.ts.
 */
import type {
  GuestProfile,
  MenuItem,
  OccupancyEvent,
  Order,
  ReservationStatus,
  WaitlistEntry,
} from "@/lib/types";

// Re-exported so door callers share the exact same business-date bucketing
// as the tab ledger — never a second definition of "what night is it".
export { businessDateFor } from "@/lib/tab";

// ---------- Occupancy (INV-D1: occupancy = Σ OccupancyEvent.delta for the night) ----------

/** Current occupancy for a business date — a pure sum, never derived from table state. */
export function computeOccupancy(events: OccupancyEvent[], businessDate: string): number {
  return events
    .filter((e) => e.businessDate === businessDate)
    .reduce((sum, e) => sum + e.delta, 0);
}

/** Guards a decrement (or any delta) from ever taking the running count below zero. */
export function canApplyOccupancyDelta(currentOccupancy: number, delta: number): boolean {
  return currentOccupancy + delta >= 0;
}

/** Occupancy / legalCapacity, 0 when capacity is unset — feeds the door header's color shift. */
export function occupancyRatio(current: number, legalCapacity: number): number {
  if (legalCapacity <= 0) return 0;
  return current / legalCapacity;
}

// ---------- Waitlist ----------

/** 1-based position among "waiting" entries only, ordered by join time — never a stored int. */
export function waitlistPosition(entries: WaitlistEntry[], entryId: string): number | null {
  const waiting = [...entries]
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  const idx = waiting.findIndex((e) => e.id === entryId);
  return idx === -1 ? null : idx + 1;
}

// ---------- Guest identity dedupe ----------

export interface DedupeCandidate {
  phone?: string;
  email?: string;
  firstName: string;
  lastName?: string;
  dobYear?: number;
}

/**
 * Ranked candidate matches for a new arrival: phone match first, then email,
 * then first+last name (with dobYear as a tiebreaker when both sides have one).
 */
export function dedupeCandidates(input: DedupeCandidate, profiles: GuestProfile[]): GuestProfile[] {
  const phoneMatches = input.phone
    ? profiles.filter((p) => !!p.phone && p.phone === input.phone)
    : [];
  const phoneIds = new Set(phoneMatches.map((p) => p.id));

  const emailMatches = input.email
    ? profiles.filter((p) => !phoneIds.has(p.id) && !!p.email && p.email.toLowerCase() === input.email!.toLowerCase())
    : [];
  const emailIds = new Set(emailMatches.map((p) => p.id));

  const nameMatches = profiles.filter((p) => {
    if (phoneIds.has(p.id) || emailIds.has(p.id)) return false;
    if (p.firstName.toLowerCase() !== input.firstName.toLowerCase()) return false;
    if ((p.lastName ?? "").toLowerCase() !== (input.lastName ?? "").toLowerCase()) return false;
    if (input.dobYear !== undefined && p.dobYear !== undefined && p.dobYear !== input.dobYear) return false;
    return true;
  });

  return [...phoneMatches, ...emailMatches, ...nameMatches];
}

// ---------- Ban check ----------

/** A ban lapses once bannedUntil passes — the door treats a lapsed ban as active-again. */
export function isBanned(profile: GuestProfile | null | undefined, now = new Date()): boolean {
  if (!profile || profile.status !== "banned") return false;
  if (profile.bannedUntil && new Date(profile.bannedUntil) <= now) return false;
  return true;
}

// ---------- Reservation no-show gating ----------

/** No-show is only reachable from a confirmed reservation that never seated. */
export function canMarkNoShow(status: ReservationStatus): boolean {
  return status === "confirmed";
}

// ---------- Responsible service ----------

/** Counts only delivered order items whose menu item is flagged isAlcoholic. */
export function countDeliveredAlcoholicDrinks(orders: Order[], menuItems: MenuItem[], sessionId: string): number {
  const alcoholicIds = new Set(menuItems.filter((m) => m.isAlcoholic).map((m) => m.id));
  return orders
    .filter((o) => o.sessionId === sessionId && o.status === "delivered")
    .reduce(
      (sum, o) => sum + o.items.filter((i) => alcoholicIds.has(i.menuItemId)).reduce((s, i) => s + i.quantity, 0),
      0,
    );
}
