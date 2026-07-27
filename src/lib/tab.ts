/**
 * Pure tab-ledger math — the session-as-account arithmetic (plan 16).
 * No I/O: every input is already fetched by the caller (mock-services or,
 * eventually, route handlers), so this is directly unit-testable.
 *
 * Money convention: amounts here are always integer cents (this module's
 * inputs/outputs), matching the existing promotionCents/happyHourCents
 * fields on Order — round to cents once, at the boundary, never in JSX.
 */
import type {
  Order,
  OrderItem,
  SessionBalance,
  SettlementMethod,
  TabAdjustment,
} from "@/lib/types";
import { orderLineSubtotal } from "@/lib/order-line";

// ---------- Order/line amounts, in cents ----------

/** An order's total, rounded to cents once at this boundary. */
export function orderTotalCents(order: Order): number {
  return Math.round(order.total * 100);
}

/** One order line's full amount (base × qty + add-ons) in cents. */
export function orderItemAmountCents(item: OrderItem): number {
  return Math.round(orderLineSubtotal(item.unitPrice, item.quantity, item.modifiers) * 100);
}

/**
 * Proportional amount for adjusting `quantity` units out of an order item's
 * total — add-ons are folded into the line total first, then split evenly
 * per unit, so a partial void of a line with add-ons still prices correctly
 * (INV-O5 interaction: add-on quantity is independent of line quantity).
 */
export function orderItemPartialAmountCents(item: OrderItem, quantity: number): number {
  if (item.quantity <= 0) return 0;
  const clamped = Math.max(0, Math.min(quantity, item.quantity));
  const fullCents = orderItemAmountCents(item);
  return Math.round((fullCents * clamped) / item.quantity);
}

// ---------- Adjustment totals & INV-T3 (no over-comping) ----------

/** Sum of amounts already recorded against a target, ignoring reversed rows. */
export function remainingAdjustableCents(
  targetFullCents: number,
  existingAdjustments: TabAdjustment[],
): number {
  const already = existingAdjustments
    .filter((a) => !a.reversedByAdjustmentId)
    .reduce((sum, a) => sum + a.amountCents, 0);
  return Math.max(0, targetFullCents - already);
}

/** INV-T3: an adjustment's amountCents must never exceed the remaining un-adjusted amount of its target. */
export function isAdjustmentAmountValid(
  amountCents: number,
  targetFullCents: number,
  existingAdjustments: TabAdjustment[],
): boolean {
  return (
    amountCents > 0 &&
    amountCents <= remainingAdjustableCents(targetFullCents, existingAdjustments)
  );
}

// ---------- Session balance (derived, never stored) ----------

export interface AdjustmentTotals {
  voidCents: number;
  compCents: number;
  discountCents: number;
}

/** Adjustment rows for one session, grouped by kind — reversed rows excluded (they're superseded, not deleted). */
export function sumAdjustmentsByKind(adjustments: TabAdjustment[]): AdjustmentTotals {
  const totals: AdjustmentTotals = { voidCents: 0, compCents: 0, discountCents: 0 };
  for (const adj of adjustments) {
    if (adj.reversedByAdjustmentId) continue;
    if (adj.kind === "void") totals.voidCents += adj.amountCents;
    else if (adj.kind === "comp") totals.compCents += adj.amountCents;
    else totals.discountCents += adj.amountCents;
  }
  return totals;
}

/**
 * INV-T1: net = gross − Σ adjustments, always.
 * Cancelled orders never entered revenue, so they're excluded from gross —
 * a void/comp/discount only ever applies to a delivered-or-later order.
 */
export function computeSessionBalance(
  sessionId: string,
  orders: Order[],
  adjustments: TabAdjustment[],
  minimumSpendCents: number,
): SessionBalance {
  const grossCents = orders
    .filter((o) => o.sessionId === sessionId && o.status !== "cancelled")
    .reduce((sum, o) => sum + orderTotalCents(o), 0);
  const relevant = adjustments.filter((a) => a.sessionId === sessionId);
  const { voidCents, compCents, discountCents } = sumAdjustmentsByKind(relevant);
  const adjustmentsCents = voidCents + compCents + discountCents;
  const netCents = Math.max(0, grossCents - adjustmentsCents);
  const shortfallCents = Math.max(0, minimumSpendCents - netCents);
  return {
    sessionId,
    grossCents,
    voidCents,
    compCents,
    discountCents,
    adjustmentsCents,
    netCents,
    minimumSpendCents,
    shortfallCents,
    settledCents: netCents + shortfallCents,
  };
}

/** A shortfall-ratio severity for Pulse's table-under-minimum attention item. */
export function shortfallRatio(balance: SessionBalance): number {
  if (balance.minimumSpendCents <= 0) return 0;
  return balance.shortfallCents / balance.minimumSpendCents;
}

// ---------- Merge ----------

/** Merge takes the higher of the two commitments — the bigger party's minimum wins. */
export function mergedMinimumSpendCents(a: number, b: number): number {
  return Math.max(a, b);
}

// ---------- Business date (nightEndHour bucketing — never toDateString()) ----------

/**
 * "YYYY-MM-DD" business date: a night that runs past midnight still belongs
 * to the calendar day it started on, until the venue's nightEndHour. A 03:00
 * close on a night that started Friday still buckets to Friday.
 */
export function businessDateFor(iso: string, nightEndHour: number): string {
  const at = new Date(iso);
  const bucket = new Date(at);
  if (at.getHours() < nightEndHour) {
    bucket.setDate(at.getDate() - 1);
  }
  const y = bucket.getFullYear();
  const m = String(bucket.getMonth() + 1).padStart(2, "0");
  const d = String(bucket.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Cash-out ----------

const SETTLEMENT_METHODS: SettlementMethod[] = ["terminal", "cash", "house"];

export function emptyMethodTotals(): Record<SettlementMethod, number> {
  return { terminal: 0, cash: 0, house: 0 };
}

/**
 * Expected-by-method for one business date: every session closed that date,
 * summed by its settlement method, using the settled (net + shortfall) amount.
 */
export function computeCashoutExpected(
  sessions: { id: string; status: string; settlementMethod?: SettlementMethod; settledExternallyAt?: string; minimumSpendCents?: number }[],
  orders: Order[],
  adjustments: TabAdjustment[],
  businessDate: string,
  nightEndHour: number,
): Record<SettlementMethod, number> {
  const expected = emptyMethodTotals();
  for (const session of sessions) {
    if (session.status !== "closed" || !session.settlementMethod || !session.settledExternallyAt) continue;
    if (businessDateFor(session.settledExternallyAt, nightEndHour) !== businessDate) continue;
    const balance = computeSessionBalance(session.id, orders, adjustments, session.minimumSpendCents ?? 0);
    expected[session.settlementMethod] += balance.settledCents;
  }
  return expected;
}

/** Σ counted − Σ expected, across every settlement method — can be negative. */
export function computeCashoutVariance(
  expectedByMethod: Record<SettlementMethod, number>,
  countedByMethod: Record<SettlementMethod, number>,
): number {
  const sum = (rec: Record<SettlementMethod, number>) =>
    SETTLEMENT_METHODS.reduce((total, method) => total + rec[method], 0);
  return sum(countedByMethod) - sum(expectedByMethod);
}

// ---------- Split by item ----------
// Splitting never creates new orders — it's N receipt views over one session's balance.

export interface SplitAssignment {
  orderId: string;
  orderItemId: string;
  guestIndex: number; // 0-based
}

/**
 * Per-guest cents for a "split by item" view: each assigned line's amount
 * goes to its guest; the session's fees/adjustments/unassigned lines are
 * spread evenly (evenShares-style, remainder-safe) across every guest.
 */
export function splitSessionByItems(
  orders: Order[],
  assignments: SplitAssignment[],
  guestCount: number,
): number[] {
  if (guestCount <= 0) return [];
  const perGuest = new Array(guestCount).fill(0) as number[];
  let unassignedCents = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const assignment = assignments.find((a) => a.orderItemId === item.id && a.orderId === order.id);
      const amountCents = orderItemAmountCents(item);
      if (assignment && assignment.guestIndex >= 0 && assignment.guestIndex < guestCount) {
        perGuest[assignment.guestIndex] += amountCents;
      } else {
        unassignedCents += amountCents;
      }
    }
    // Fees/tip ride on top of the item subtotal — spread with the unassigned pool too.
    const feesAndTipCents = Math.round((order.serviceFee + order.tip) * 100);
    unassignedCents += feesAndTipCents;
  }

  const base = Math.floor(unassignedCents / guestCount);
  const remainder = unassignedCents - base * guestCount;
  for (let i = 0; i < guestCount; i++) {
    perGuest[i] += base + (i < remainder ? 1 : 0);
  }
  return perGuest;
}
