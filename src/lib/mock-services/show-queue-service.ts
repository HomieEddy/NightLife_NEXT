/**
 * mockShowQueueService — a single-slot lock for bottle-presentation walk-outs
 * (sparkler parades, LED signs). Simpler than a real queue: only one show can
 * be "in progress" at a time, so a second runner sees the floor is busy and
 * waits instead of colliding with the first walk-out.
 * Plan 07 ships ActiveShowLock with SELECT … FOR UPDATE; this mock
 * stays for the permanent Live Demo sandbox.
 */
import type { ActiveShow, Order } from "@/lib/types";
import { showLabelFor } from "@/lib/order-presentation";
import { delay } from "./delay";

let activeShow: ActiveShow | null = null;

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
