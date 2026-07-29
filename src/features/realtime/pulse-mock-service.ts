/**
 * mockPulseService — live-night state for the manager's floor pulse: staff
 * broadcasts and the last-call sequence. The attention-feed *items* are
 * derived, not stored (see src/lib/pulse.ts) — these are the two pieces of
 * genuinely new mutable state.
 * Plan 07 ships real implementations (floor-core.ts + SSE); this mock
 * stays for the permanent Live Demo sandbox.
 */
import type { AttentionAcknowledgment, Broadcast } from "@/lib/types";
import { mockStaffService } from "@/features/workforce/staff-mock-service";
import { clone, delay, uid } from "@/features/shared/delay";

let broadcasts: Broadcast[] = [];
let lastCallActive = false;
let lastCallStartedAt: string | null = null;
let acknowledgments: AttentionAcknowledgment[] = [];

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

  /** RT-01: Staff marks an attention item as being handled. */
  async acknowledgeAttentionItem(attentionItemId: string, staffId: string, staffName: string): Promise<AttentionAcknowledgment> {
    await delay(200);
    const ack: AttentionAcknowledgment = {
      id: uid("ack"),
      attentionItemId,
      acknowledgedByStaffId: staffId,
      acknowledgedByStaffName: staffName,
      acknowledgedAt: new Date().toISOString(),
    };
    acknowledgments = [ack, ...acknowledgments];
    return clone(ack);
  },

  async snoozeAttentionItem(attentionItemId: string, durationMinutes: number, staffId: string, staffName: string): Promise<AttentionAcknowledgment> {
    await delay(200);
    const snoozedUntil = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const ack: AttentionAcknowledgment = {
      id: uid("ack"),
      attentionItemId,
      acknowledgedByStaffId: staffId,
      acknowledgedByStaffName: staffName,
      acknowledgedAt: new Date().toISOString(),
      snoozedUntil,
    };
    acknowledgments = [ack, ...acknowledgments];
    return clone(ack);
  },

  /** List full acknowledgment state — callers filter by attention item id or staff. */
  async listAcknowledgments(): Promise<AttentionAcknowledgment[]> {
    await delay(100);
    return clone(acknowledgments);
  },
};
