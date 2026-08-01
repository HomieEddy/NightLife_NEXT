/**
 * mockNotificationService ÔÇö demo-track dispatch layer.
 * Logs push notifications in-memory so the Pulse feed or notification
 * panel can display recent dispatches. Real push goes through
 * src/server/notifications/push.ts in the live build.
 */
import { clone, delay, uid } from "@/features/shared/delay";

export interface MockPushEntry {
  id: string;
  eventType: string;
  title: string;
  body?: string;
  targetRoles: string[];
  venueId: string;
  createdAt: string;
}

let pushes: MockPushEntry[] = [];

export const mockNotificationService = {
  async listRecentPushes(limit = 20): Promise<MockPushEntry[]> {
    await delay();
    return clone(pushes).slice(0, limit);
  },

  /** NT-02, NT-06, NT-08: event-driven push to target roles. */
  async dispatchPush(eventType: string, title: string, body: string, targetRoles: string[]): Promise<MockPushEntry> {
    await delay(100);
    const entry: MockPushEntry = {
      id: uid("push"),
      eventType,
      title,
      body,
      targetRoles,
      venueId: "venue-1",
      createdAt: new Date().toISOString(),
    };
    pushes = [entry, ...pushes].slice(0, 100);
    return clone(entry);
  },

  /** NT-13: shift reminder push to a specific staff member. */
  async dispatchShiftReminder(staffId: string, staffName: string, startTime: string): Promise<MockPushEntry> {
    return this.dispatchPush(
      "shift-upcoming",
      "Your shift starts soon",
      `${staffName}, your shift starts at ${startTime}.`,
      [staffId],
    );
  },
};
