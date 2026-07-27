import type {
  AttentionItem,
  GuestSession,
  HelpRequest,
  HelpRequestType,
  Order,
  TabAdjustment,
  Venue,
  VenueTable,
  Zone,
} from "@/lib/types";
import { computeSessionBalance, shortfallRatio } from "@/lib/tab";

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
