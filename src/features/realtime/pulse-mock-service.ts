/**
 * mockPulseService — live-night state for the manager's floor pulse: staff
 * broadcasts and the last-call sequence. The attention-feed *items* are
 * derived, not stored (see src/lib/pulse.ts) — these are the two pieces of
 * genuinely new mutable state.
 * Plan 07 ships real implementations (floor-core.ts + SSE); this mock
 * stays for the permanent Live Demo sandbox.
 */
import type { Broadcast } from "@/lib/types";
import { mockStaffService } from "@/features/workforce/staff-mock-service";
import { clone, delay, uid } from "@/features/shared/delay";

let broadcasts: Broadcast[] = [];
let lastCallActive = false;
let lastCallStartedAt: string | null = null;

const CHANNELS = ["floor", "bar", "security"] as const;

/** Broadcasts and last-call announcements aren't authored by whichever
 *  runner the /staff panel happens to be simulating — they're the manager. */
function managerAuthor(name: string) {
  return { id: "manager-broadcast", name, role: "manager" as const };
}

export const mockPulseService = {
  async listBroadcasts(): Promise<Broadcast[]> {
    await delay(200);
    return clone(broadcasts).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  },

  async sendBroadcast(message: string, sentBy: string): Promise<Broadcast> {
    await delay(400);
    const broadcast: Broadcast = {
      id: uid("bc"),
      message,
      sentAt: new Date().toISOString(),
      sentBy,
    };
    broadcasts = [broadcast, ...broadcasts];
    await Promise.all(
      CHANNELS.map((channel) =>
        mockStaffService.sendMessage({
          channel,
          body: `${sentBy}: ${message}`,
          author: managerAuthor(sentBy),
        }),
      ),
    );
    return clone(broadcast);
  },

  async getLastCallState(): Promise<{ active: boolean; startedAt: string | null }> {
    await delay(150);
    return { active: lastCallActive, startedAt: lastCallStartedAt };
  },

  async startLastCall(sentBy: string): Promise<void> {
    await delay(400);
    lastCallActive = true;
    lastCallStartedAt = new Date().toISOString();
    await Promise.all(
      CHANNELS.map((channel) =>
        mockStaffService.sendMessage({
          channel,
          body: `${sentBy} started last call — no new orders are being accepted.`,
          author: managerAuthor(sentBy),
        }),
      ),
    );
  },

  async endLastCall(): Promise<void> {
    await delay(300);
    lastCallActive = false;
    lastCallStartedAt = null;
  },
};
