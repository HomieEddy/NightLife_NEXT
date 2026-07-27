import type {
  AttentionItem,
  GuestSession,
  HelpRequest,
  HelpRequestType,
  Incident,
  Order,
  StaffMember,
  TabAdjustment,
  TimeEntry,
  Venue,
  VenueTable,
  WaitlistEntry,
  Zone,
} from "@/lib/types";
import { computeSessionBalance, shortfallRatio } from "@/lib/tab";
import { occupancyRatio } from "@/lib/door";

const HELP_LABELS: Record<HelpRequestType, string> = {
  "call-waiter": "Call waiter",
  "refill-ice": "Refill ice",
  "clean-table": "Clean table",
  security: "Security",
  bill: "Bill",
};

// Orders past these statuses are already handled — no point flagging them.
const ACTIVE_ORDER_STATUSES: Order["status"][] = ["pending", "accepted", "preparing"];

function ageMinutes(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

/**
 * Pure aggregation for the manager's live "needs attention" feed. No I/O —
 * every input is already fetched by the caller, so this is trivially
 * testable once the suite exists (see AGENTS.md §7).
 */
export function computeAttentionItems(
  orders: Order[],
  helpRequests: HelpRequest[],
  tables: VenueTable[],
  zones: Zone[],
  thresholds: Venue["slaThresholds"],
  lastCallActive: boolean,
  autoFlagTables: boolean,
  /** Plan 16: open sessions + their ledger, to flag tables under their minimum at last call. */
  sessions: GuestSession[] = [],
  adjustments: TabAdjustment[] = [],
  minimumSpendWarningRatio = 0.25,
  /** Plan 17: door capacity, the walk-in waitlist and open incidents feed three more attention types. */
  door?: {
    occupancy: number;
    legalCapacity: number;
    occupancyWarnRatio: number;
    waitlistEntries: WaitlistEntry[];
    openIncidents: Incident[];
  },
  /** Plan 18: workforce coverage gaps and missing clock-outs. */
  workforce?: {
    coverageGaps: { zoneId: string; zoneName: string; missingRoles: string[] }[];
    openTimeEntries: TimeEntry[];
    nightEndHour: number;
    clockedInStaff: StaffMember[];
  },
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const order of orders) {
    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) continue;
    const age = ageMinutes(order.placedAt);
    if (age >= thresholds.orderCriticalMinutes) {
      items.push(orderItem(order, age, "critical"));
    } else if (age >= thresholds.orderWarnMinutes) {
      items.push(orderItem(order, age, "warning"));
    }
  }

  for (const request of helpRequests) {
    if (request.status === "resolved") continue;
    const age = ageMinutes(request.createdAt);
    const table = tables.find((t) => t.code === request.tableCode);
    if (!table) continue; // defensive — mock data always matches
    if (age >= thresholds.helpCriticalMinutes) {
      items.push(helpItem(request, table, age, "critical"));
    } else if (age >= thresholds.helpWarnMinutes) {
      items.push(helpItem(request, table, age, "warning"));
    }
  }

  // Last-call nudges are derived, not stored — toggling either flag off
  // clears them from the feed immediately.
  if (lastCallActive && autoFlagTables) {
    for (const table of tables) {
      if (table.status !== "occupied") continue;
      items.push({
        id: `table-${table.id}`,
        type: "table-closeout",
        severity: "warning",
        tableId: table.id,
        tableCode: table.code,
        zoneName: zones.find((z) => z.id === table.zoneId)?.name ?? "",
        message: "Last call — nudge this table to close out",
        ageMinutes: 0,
      });
    }
  }

  // At last call, flag every open session still short of its minimum — severity
  // scales with the shortfall ratio (plan 16). Derived, never stored.
  if (lastCallActive) {
    for (const session of sessions) {
      if (session.status !== "approved") continue;
      const table = tables.find((t) => t.id === session.tableId);
      if (!table) continue;
      const balance = computeSessionBalance(session.id, orders, adjustments, session.minimumSpendCents ?? 0);
      if (balance.shortfallCents <= 0) continue;
      const ratio = shortfallRatio(balance);
      items.push({
        id: `minimum-${session.id}`,
        type: "table-under-minimum",
        severity: ratio >= minimumSpendWarningRatio * 2 ? "critical" : "warning",
        tableId: table.id,
        tableCode: table.code,
        zoneName: zones.find((z) => z.id === table.zoneId)?.name ?? "",
        message: `${session.displayName} — $${(balance.shortfallCents / 100).toFixed(0)} short of minimum`,
        ageMinutes: 0,
      });
    }
  }

  if (door) {
    const ratio = occupancyRatio(door.occupancy, door.legalCapacity);
    if (ratio >= 1) {
      items.push({
        id: "capacity-critical",
        type: "capacity-warning",
        severity: "critical",
        tableId: "venue",
        tableCode: "DOOR",
        zoneName: "",
        message: `At capacity — ${door.occupancy}/${door.legalCapacity}`,
        ageMinutes: 0,
      });
    } else if (ratio >= door.occupancyWarnRatio) {
      items.push({
        id: "capacity-warning",
        type: "capacity-warning",
        severity: "warning",
        tableId: "venue",
        tableCode: "DOOR",
        zoneName: "",
        message: `Approaching capacity — ${door.occupancy}/${door.legalCapacity}`,
        ageMinutes: 0,
      });
    }

    for (const entry of door.waitlistEntries) {
      if (entry.status !== "waiting") continue;
      const age = ageMinutes(entry.joinedAt);
      if (age <= entry.quotedMinutes) continue;
      items.push({
        id: `waitlist-${entry.id}`,
        type: "waitlist-overdue",
        severity: age >= entry.quotedMinutes * 2 ? "critical" : "warning",
        tableId: "waitlist",
        tableCode: entry.name,
        zoneName: "",
        message: `${entry.name}, party of ${entry.partySize} — ${Math.round(age)} min, quoted ${entry.quotedMinutes}`,
        ageMinutes: age,
      });
    }

    for (const incident of door.openIncidents) {
      const age = ageMinutes(incident.occurredAt);
      items.push({
        id: `incident-${incident.id}`,
        type: "incident-open",
        severity: incident.severity === "high" ? "critical" : "warning",
        tableId: incident.tableId ?? "incident",
        tableCode: incident.type.replace(/-/g, " "),
        zoneName: zones.find((z) => z.id === incident.zoneId)?.name ?? "",
        message: `Open ${incident.type.replace(/-/g, " ")} incident — ${Math.round(age)} min`,
        ageMinutes: age,
      });
    }
  }

  if (workforce) {
    for (const gap of workforce.coverageGaps) {
      items.push({
        id: `coverage-${gap.zoneId}`,
        type: "zone-uncovered",
        severity: "warning",
        tableId: gap.zoneId,
        tableCode: gap.zoneName,
        zoneName: gap.zoneName,
        message: `${gap.zoneName} has open orders but no ${gap.missingRoles.join(" or ")} clocked in`,
        ageMinutes: 0,
      });
    }

    const deadlineMs = 4 * 60 * 60_000; // 4h past nightEndHour
    for (const entry of workforce.openTimeEntries) {
      if (entry.clockOutAt) continue;
      const age = ageMinutes(entry.clockInAt!);
      const missingSince = new Date(entry.clockInAt!).getTime() + deadlineMs;
      if (Date.now() < missingSince) continue;
      const staff = workforce.clockedInStaff.find((s) => s.id === entry.staffId);
      items.push({
        id: `clock-missing-${entry.id}`,
        type: "clock-out-missing",
        severity: "critical",
        tableId: "workforce",
        tableCode: staff?.name ?? entry.staffId,
        zoneName: "",
        message: `${staff?.name ?? entry.staffId} still clocked in after ${Math.round(age / 60)}h — forgotten clock-out?`,
        ageMinutes: age,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.ageMinutes - a.ageMinutes;
  });
}

function orderItem(order: Order, age: number, severity: AttentionItem["severity"]): AttentionItem {
  return {
    id: `order-${order.id}`,
    type: "order-overdue",
    severity,
    tableId: order.tableId,
    tableCode: order.tableCode,
    zoneName: order.zoneName,
    message: `Order ${order.code} ${order.status} ${Math.round(age)} min`,
    ageMinutes: age,
  };
}

function helpItem(
  request: HelpRequest,
  table: VenueTable,
  age: number,
  severity: AttentionItem["severity"],
): AttentionItem {
  return {
    id: `help-${request.id}`,
    type: "help-open",
    severity,
    tableId: table.id,
    tableCode: request.tableCode,
    zoneName: request.zoneName,
    message: `${HELP_LABELS[request.type]} — open ${Math.round(age)} min`,
    ageMinutes: age,
  };
}
