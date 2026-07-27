/**
 * mockCashoutService — the nightly reconciliation (Z-report), plan 16.
 * Live mode persists this as an insert-only shift_cashouts table.
 */
import type { GuestSession, Order, SettlementMethod, ShiftCashout, TabAdjustment } from "@/lib/types";
import { mockVenue } from "@/lib/mock-data/venue";
import { computeCashoutExpected, computeCashoutVariance, emptyMethodTotals } from "@/lib/tab";
import { clone, delay, uid } from "./delay";
import { mockAuditService } from "./audit-service";

let cashouts: ShiftCashout[] = [];

export const mockCashoutService = {
  async listCashouts(staffId?: string): Promise<ShiftCashout[]> {
    await delay();
    const result = staffId ? cashouts.filter((c) => c.staffId === staffId) : cashouts;
    return clone(result).sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  },

  /** Expected-by-method preview before closing — the number the closer counts against. */
  async previewExpected(
    businessDate: string,
    nightEndHour: number,
    sessions: GuestSession[],
    orders: Order[],
    adjustments: TabAdjustment[],
    staffId?: string,
  ): Promise<Record<SettlementMethod, number>> {
    await delay(200);
    // A staff-scoped drawer only counts sessions the same staff member closed —
    // demo simplification: the venue-wide close (no staffId) sees everything.
    void staffId;
    return computeCashoutExpected(sessions, orders, adjustments, businessDate, nightEndHour);
  },

  async closeCashout(input: {
    staffId?: string;
    businessDate: string;
    expectedByMethod: Record<SettlementMethod, number>;
    countedByMethod: Record<SettlementMethod, number>;
    note?: string;
    closedByStaffId: string;
    closedByStaffName: string;
  }): Promise<ShiftCashout> {
    await delay(400);
    const variance = computeCashoutVariance(input.expectedByMethod, input.countedByMethod);
    const now = new Date().toISOString();
    const cashout: ShiftCashout = {
      id: uid("cashout"),
      venueId: mockVenue.id,
      staffId: input.staffId,
      businessDate: input.businessDate,
      openedAt: now,
      closedAt: now,
      expectedByMethod: { ...emptyMethodTotals(), ...input.expectedByMethod },
      countedByMethod: { ...emptyMethodTotals(), ...input.countedByMethod },
      varianceCents: variance,
      note: input.note,
      closedByStaffId: input.closedByStaffId,
      closedByStaffName: input.closedByStaffName,
    };
    cashouts = [cashout, ...cashouts];
    await mockAuditService.record({
      actorStaffId: input.closedByStaffId,
      actorName: input.closedByStaffName,
      action: "cashout:close",
      targetType: "cashout",
      targetId: cashout.id,
      summary: `Closed ${input.staffId ? "drawer" : "venue"} cash-out for ${input.businessDate} — variance ${variance >= 0 ? "+" : ""}${(variance / 100).toFixed(2)}`,
      metadata: { businessDate: input.businessDate, varianceCents: variance },
    });
    return clone(cashout);
  },
};
