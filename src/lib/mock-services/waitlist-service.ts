/**
 * mockWaitlistService — future backend boundary for the walk-in waitlist
 * (plan 17). Position is always recomputed from src/lib/door.ts's
 * waitlistPosition(), never stored as a mutable int on the row.
 */
import type { WaitlistEntry, WaitlistStatus } from "@/lib/types";
import { mockWaitlistEntries } from "@/lib/mock-data/door";
import { mockVenue } from "@/lib/mock-data/venue";
import { waitlistPosition } from "@/lib/door";
import { clone, delay, uid } from "./delay";

let entries: WaitlistEntry[] = clone(mockWaitlistEntries);

export interface WaitlistEntryWithPosition extends WaitlistEntry {
  /** null once the entry has left "waiting" — position only makes sense for the active queue. */
  position: number | null;
}

export const mockWaitlistService = {
  async listEntries(status?: WaitlistStatus): Promise<WaitlistEntryWithPosition[]> {
    await delay();
    const withPosition: WaitlistEntryWithPosition[] = entries.map((e) => ({
      ...clone(e),
      position: waitlistPosition(entries, e.id),
    }));
    const filtered = status ? withPosition.filter((e) => e.status === status) : withPosition;
    return filtered.sort((a, b) => {
      if (a.status === "waiting" && b.status === "waiting") return (a.position ?? 0) - (b.position ?? 0);
      return b.joinedAt.localeCompare(a.joinedAt);
    });
  },

  async join(input: {
    name: string;
    partySize: number;
    phone?: string;
    quotedMinutes: number;
    guestProfileId?: string;
  }): Promise<WaitlistEntry> {
    await delay(300);
    const entry: WaitlistEntry = {
      id: uid("wl"),
      venueId: mockVenue.id,
      guestProfileId: input.guestProfileId,
      name: input.name.trim(),
      partySize: input.partySize,
      phone: input.phone?.trim() || undefined,
      quotedMinutes: input.quotedMinutes,
      status: "waiting",
      joinedAt: new Date().toISOString(),
    };
    entries = [...entries, entry];
    return clone(entry);
  },

  async setStatus(id: string, status: WaitlistStatus): Promise<WaitlistEntry | null> {
    await delay(250);
    const entry = entries.find((e) => e.id === id);
    if (!entry) return null;
    entry.status = status;
    if (status === "notified") entry.notifiedAt = new Date().toISOString();
    return clone(entry);
  },
};
