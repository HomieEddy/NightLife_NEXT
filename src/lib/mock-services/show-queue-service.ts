/**
 * mockShowQueueService — a single-slot lock for bottle-presentation walk-outs
 * (sparkler parades, LED signs). Simpler than a real queue: only one show can
 * be "in progress" at a time, so a second runner sees the floor is busy and
 * waits instead of colliding with the first walk-out.
 * Plan 07 ships ActiveShowLock with SELECT … FOR UPDATE; this mock
 * stays for the permanent Live Demo sandbox.
 */
import type { ActiveShow, Order } from "@/lib/types";
import { delay } from "./delay";

let activeShow: ActiveShow | null = null;

/** An order needs a show if any item carries a "Presentation" modifier. */
export function orderNeedsShow(order: Order): boolean {
  return order.items.some((item) => item.modifiers.some((m) => m.groupName === "Presentation"));
}

/** The presentation label(s) for an order, e.g. "Sparkler parade". */
export function showLabelFor(order: Order): string {
  const labels = order.items.flatMap((item) =>
    item.modifiers.filter((m) => m.groupName === "Presentation").map((m) => m.optionName),
  );
  return labels.length > 0 ? labels.join(" + ") : "Presentation";
}

export const mockShowQueueService = {
  async getActiveShow(): Promise<ActiveShow | null> {
    await delay(150);
    return activeShow;
  },

  /** Fails (returns ok: false) if another table's show is already walking. */
  async startShow(order: Order, staffName: string): Promise<{ ok: boolean; activeShow: ActiveShow | null }> {
    await delay(300);
    if (activeShow) return { ok: false, activeShow };
    activeShow = {
      orderId: order.id,
      tableCode: order.tableCode,
      zoneName: order.zoneName,
      label: showLabelFor(order),
      staffName,
      startedAt: new Date().toISOString(),
    };
    return { ok: true, activeShow };
  },

  async finishShow(): Promise<void> {
    await delay(250);
    activeShow = null;
  },
};
