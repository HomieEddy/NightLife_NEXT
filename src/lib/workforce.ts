import type {
  CommissionRule,
  CommissionStatement,
  Order,
  Shift,
  ShiftTemplate,
  StaffMember,
  StaffRole,
  TimeEntry,
  TipDistribution,
  TipPoolRule,
  Zone,
} from "./types";

/** Map a clock time "HH:MM" to the business date YYYY-MM-DD for a given night config.
 *  A shift starting at 22:00 Friday when nightEndHour is 4:00 belongs to Friday. */
export function businessDateForShift(startDateTime: Date, nightEndHour: number): string {
  const d = new Date(startDateTime);
  if (d.getHours() < nightEndHour) {
    d.setDate(d.getDate() - 1);
  }
  // Use local date components — d.getHours() is local, toISOString() is UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compute minutes worked from clock-in to clock-out, subtracting unpaid break time. */
export function computeMinutesWorked(entry: TimeEntry): number {
  if (!entry.clockOutAt) return 0;
  const start = new Date(entry.clockInAt).getTime();
  const end = new Date(entry.clockOutAt).getTime();
  let total = (end - start) / 60_000;

  for (const b of entry.breaks) {
    if (!b.endedAt) continue;
    const bStart = new Date(b.startedAt).getTime();
    const bEnd = new Date(b.endedAt).getTime();
    const breakMinutes = (bEnd - bStart) / 60_000;
    if (!b.paid) total -= breakMinutes;
  }
  return Math.max(0, Math.round(total));
}

/** Derive isOnShift: true when the staff member has an open TimeEntry (clocked in, not yet out). */
export function isStaffOnShift(entries: TimeEntry[], staffId: string): boolean {
  return entries.some((e) => e.staffId === staffId && e.clockInAt && !e.clockOutAt);
}

/** Generate dated Shift[] for a week from ShiftTemplate[] and a Monday date string "YYYY-MM-DD". */
export function generateWeekFromTemplates(
  templates: ShiftTemplate[],
  staff: StaffMember[],
  weekStartMonday: string,
  venueId: string,
): Shift[] {
  const monday = new Date(weekStartMonday + "T00:00:00");
  if (isNaN(monday.getTime())) return [];

  const shifts: Shift[] = [];
  let tid = 1;

  for (const t of templates) {
    if (!t.active) continue;
    const member = staff.find((s) => s.id === t.staffId && s.accountStatus === "active");
    if (!member) continue;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      // dayOfWeek: 0=Sun, 1=Mon ... 6=Sat. Monday is day 1.
      const targetDow = (1 + dayOffset) % 7; // Mon=1, Tue=2 ... Sun=0
      if (t.dayOfWeek !== targetDow) continue;

      const date = new Date(monday);
      date.setDate(date.getDate() + dayOffset);
      const d = date.toISOString().slice(0, 10);

      shifts.push({
        id: `shift-${venueId}-${d}-${tid++}`,
        venueId,
        staffId: t.staffId,
        businessDate: d,
        scheduledStart: t.startTime,
        scheduledEnd: t.endTime,
        zoneId: t.zoneId,
        role: t.role ?? member.role,
        status: "draft",
        templateId: t.id,
      });
    }
  }
  return shifts;
}

/** Find zones with open orders served by no clocked-in staff of the required role. */
export function computeCoverageGaps(
  zones: Zone[],
  openOrders: Order[],
  clockedInStaff: StaffMember[],
  orderZoneIds: Set<string>,
): { zoneId: string; zoneName: string; missingRoles: StaffRole[] }[] {
  const results: { zoneId: string; zoneName: string; missingRoles: StaffRole[] }[] = [];
  const rolesNeeded: StaffRole[] = ["bartender", "runner"];

  for (const zone of zones) {
    if (!orderZoneIds.has(zone.id)) continue;
    const staffInZone = clockedInStaff.filter((s) => s.assignedZoneIds.includes(zone.id));
    const missing: StaffRole[] = [];

    for (const role of rolesNeeded) {
      if (!staffInZone.some((s) => s.role === role)) {
        missing.push(role);
      }
    }
    if (missing.length > 0) {
      results.push({ zoneId: zone.id, zoneName: zone.name, missingRoles: missing });
    }
  }
  return results;
}

/**
 * Distribute tip pool by the active rule. Returned shareCents sum exactly to poolCents using
 * the largest-remainder method (same discipline as evenShares() elsewhere).
 */
export function computeTipDistribution(
  rule: TipPoolRule,
  poolCents: number,
  staff: StaffMember[],
  entries: TimeEntry[],
): TipDistribution["lines"] {
  if (poolCents <= 0 || staff.length === 0) return [];

  let clean = poolCents;
  if (rule.houseRetentionPct > 0) {
    clean = poolCents - Math.round((poolCents * rule.houseRetentionPct) / 100);
  }

  const eligible = staff.filter(
    (s) =>
      rule.includeRoles.includes(s.role) &&
      entries.some((e) => e.staffId === s.id && e.minutesWorked != null && e.minutesWorked > 0),
  );
  if (eligible.length === 0) return [];

  const perS: { staffId: string; basisVal: number }[] = [];

  if (rule.basis === "equal") {
    for (const s of eligible) perS.push({ staffId: s.id, basisVal: 1 });
  } else if (rule.basis === "hours-weighted") {
    for (const s of eligible) {
      const mins =
        entries
          .filter((e) => e.staffId === s.id && e.minutesWorked != null)
          .reduce((sum, e) => sum + (e.minutesWorked ?? 0), 0) *
        (s.tipPoolWeight ?? 1.0);
      perS.push({ staffId: s.id, basisVal: mins });
    }
  } else if (rule.basis === "role-percentage" && rule.rolePercentages) {
    for (const s of eligible) {
      const pct = rule.rolePercentages[s.role] ?? 0;
      perS.push({ staffId: s.id, basisVal: pct });
    }
  }

  const totalBasis = perS.reduce((sum, x) => sum + x.basisVal, 0);
  if (totalBasis <= 0) return [];

  // largest-remainder
  let allocated = 0;
  const lines = perS.map((x) => {
    const exact = (x.basisVal / totalBasis) * clean;
    const floor = Math.floor(exact);
    return { staffId: x.staffId, basisValue: x.basisVal, shareCents: floor, rem: exact - floor };
  });
  allocated = lines.reduce((sum, l) => sum + l.shareCents, 0);
  const remainder = clean - allocated;

  lines.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remainder; i++) {
    lines[i % lines.length].shareCents += 1;
  }

  return lines.map(({ staffId, basisValue, shareCents }) => ({
    staffId,
    basisValue,
    shareCents,
  }));
}

/** Compute a promoter's commission on attributed reservations/sessions. */
export function computeCommission(
  rule: CommissionRule,
  items: { sourceId: string; sourceType: "reservation" | "session" | "order"; basisCents: number }[],
): number {
  let total = 0;
  for (const item of items) {
    if (rule.ratePct != null) {
      total += Math.round((item.basisCents * rule.ratePct) / 100);
    } else if (rule.flatCents != null) {
      total += rule.flatCents;
    }
  }
  return total;
}

// ---------- WF-06: Break compliance (Quebec labor law) ----------

export interface BreakComplianceStatus {
  staffId: string;
  minutesSinceLastBreak: number;
  requiredAfterMinutes: number;
  breakDurationMinutes: number;
  status: "ok" | "due" | "overdue";
}

/**
 * How long since the staff member's last break (or clock-in if no break taken).
 * An open (ongoing) break returns 0 minutes since last break.
 */
export function minutesSinceLastBreak(entry: TimeEntry, now = new Date()): number {
  if (!entry.clockInAt) return 0;
  const lastBreakEnd = [...entry.breaks]
    .filter((b) => b.endedAt)
    .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))
    [0]?.endedAt;
  // Currently on break — no compliance concern
  if (entry.breaks.some((b) => !b.endedAt)) return 0;
  const ref = lastBreakEnd ? new Date(lastBreakEnd).getTime() : new Date(entry.clockInAt).getTime();
  return Math.max(0, Math.round((now.getTime() - ref) / 60_000));
}

/**
 * Break compliance for a single clocked-in staff member.
 * - "ok": under the threshold
 * - "due": at or past threshold, should take a break soon
 * - "overdue": past threshold + breakDuration (compliance violation)
 */
export function getBreakComplianceStatus(
  entry: TimeEntry,
  requiredAfterMinutes: number,
  breakDurationMinutes: number,
  now = new Date(),
): BreakComplianceStatus {
  const mins = minutesSinceLastBreak(entry, now);
  let status: BreakComplianceStatus["status"] = "ok";
  if (mins >= requiredAfterMinutes + breakDurationMinutes) {
    status = "overdue";
  } else if (mins >= requiredAfterMinutes) {
    status = "due";
  }
  return {
    staffId: entry.staffId,
    minutesSinceLastBreak: mins,
    requiredAfterMinutes,
    breakDurationMinutes,
    status,
  };
}

/** All clocked-in staff who need a break (status "due" or "overdue"). */
export function listStaffNeedingBreak(
  entries: TimeEntry[],
  requiredAfterMinutes: number,
  breakDurationMinutes: number,
  now = new Date(),
): BreakComplianceStatus[] {
  return entries
    .filter((e) => e.clockInAt && !e.clockOutAt)
    .map((e) => getBreakComplianceStatus(e, requiredAfterMinutes, breakDurationMinutes, now))
    .filter((s) => s.status !== "ok");
}

/** Build a CommissionStatement from attributed items and a rule. */
export function buildCommissionStatement(
  rule: CommissionRule,
  staffId: string,
  venueId: string,
  periodStart: string,
  periodEnd: string,
  items: CommissionStatement["lines"],
): CommissionStatement {
  const totalCents = items.reduce((sum, l) => sum + l.earnedCents, 0);
  return {
    id: `cs-${venueId}-${staffId}-${periodStart}`,
    venueId,
    staffId,
    periodStart,
    periodEnd,
    lines: items,
    totalCents,
    status: "draft",
  };
}
