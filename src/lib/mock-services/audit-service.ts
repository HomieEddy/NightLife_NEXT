/**
 * mockAuditService — the venue-wide, append-only audit trail every sensitive
 * action writes to (plan 16). Deliberately generic: plans 17-19 write to the
 * same table (refusals/ejections, schedule edits/payouts, stock corrections).
 * Live mode persists this as an insert-only audit_entries table.
 */
import type { AuditEntry } from "@/lib/types";
import { mockAuditEntries } from "@/lib/mock-data/tab";
import { mockVenue } from "@/lib/mock-data/venue";
import { clone, delay, uid } from "./delay";

let entries: AuditEntry[] = clone(mockAuditEntries);

export const mockAuditService = {
  /** Records one audit row. Called in the same synchronous step as the effect it describes. */
  async record(input: {
    actorStaffId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: uid("audit"),
      venueId: mockVenue.id,
      createdAt: new Date().toISOString(),
      ...input,
    };
    entries = [entry, ...entries];
    return clone(entry);
  },

  async listEntries(filter?: {
    actorStaffId?: string;
    action?: string;
    from?: string;
    to?: string;
  }): Promise<AuditEntry[]> {
    await delay();
    let result = entries;
    if (filter?.actorStaffId) result = result.filter((e) => e.actorStaffId === filter.actorStaffId);
    if (filter?.action) result = result.filter((e) => e.action === filter.action);
    if (filter?.from) result = result.filter((e) => e.createdAt >= filter.from!);
    if (filter?.to) result = result.filter((e) => e.createdAt <= filter.to!);
    return clone(result).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
