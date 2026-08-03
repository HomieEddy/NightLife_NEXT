import { describe, it, expect, vi } from "vitest";
import {
  anonymizeClosedGuestSessions,
  truncateNotificationLogs,
  deleteOldDomainEvents,
  deleteOldAuditEntries,
  purgeStaleLeads,
  deleteExpiredSessions,
  deleteExpiredVerifications,
  deleteExpiredInvitations,
  runTenantRetention,
} from "./retention-core";
import type { ScopedDb } from "@/features/shared/db";

function mockScopedDb(overrides: Record<string, unknown> = {}): ScopedDb {
  return {
    guestSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    notificationLog: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    domainEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditEntry: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  } as unknown as ScopedDb;
}

// ── anonymizeClosedGuestSessions ──────────────────────────────────────

describe("anonymizeClosedGuestSessions", () => {
  it("updates closed sessions past cutoff, scrubbing displayName and guestProfileId", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const db = mockScopedDb({ guestSession: { updateMany } });
    const cutoff = new Date("2026-05-01");

    const count = await anonymizeClosedGuestSessions(db, cutoff);
    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledTimes(1);

    const call = updateMany.mock.calls[0][0];
    expect(call.where.status).toBe("closed");
    expect(call.where.updatedAt.lte).toEqual(cutoff);
    expect(call.where.OR).toHaveLength(2);
    expect(call.data.displayName).toBe("");
    expect(call.data.guestProfileId).toBeNull();
  });

  it("skips sessions already anonymized (no non-empty displayName and no non-null guestProfileId)", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const db = mockScopedDb({ guestSession: { updateMany } });

    const count = await anonymizeClosedGuestSessions(db, new Date());
    expect(count).toBe(0);
  });
});

// ── truncateNotificationLogs ──────────────────────────────────────────

describe("truncateNotificationLogs", () => {
  it("truncates recipient from logs older than cutoff where recipient is non-empty", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 5 });
    const db = mockScopedDb({ notificationLog: { updateMany } });
    const cutoff = new Date("2026-05-01");

    const count = await truncateNotificationLogs(db, cutoff);
    expect(count).toBe(5);

    const call = updateMany.mock.calls[0][0];
    expect(call.where.createdAt.lte).toEqual(cutoff);
    expect(call.where.recipient.not).toBe("");
    expect(call.data.recipient).toBe("");
  });
});

// ── deleteOldDomainEvents ─────────────────────────────────────────────

describe("deleteOldDomainEvents", () => {
  it("deletes domain events older than cutoff", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 12 });
    const db = mockScopedDb({ domainEvent: { deleteMany } });
    const cutoff = new Date("2026-07-01");

    const count = await deleteOldDomainEvents(db, cutoff);
    expect(count).toBe(12);
    expect(deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lte: cutoff } } });
  });
});

// ── deleteOldAuditEntries ─────────────────────────────────────────────

describe("deleteOldAuditEntries", () => {
  it("deletes audit entries older than cutoff", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 7 });
    const db = mockScopedDb({ auditEntry: { deleteMany } });

    const count = await deleteOldAuditEntries(db, new Date("2025-08-01"));
    expect(count).toBe(7);
  });
});

// ── purgeStaleLeads (platform-scope) ──────────────────────────────────

describe("purgeStaleLeads", () => {
  it("deletes closed/lost leads older than 12 months and new/contacted leads idle over 6 months", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 4 });
    const prisma = { lead: { deleteMany } } as unknown as import("@prisma/client").PrismaClient;

    const count = await purgeStaleLeads(prisma);
    expect(count).toBe(4);

    const call = deleteMany.mock.calls[0][0];
    expect(call.where.OR).toHaveLength(2);
    // closed/lost with updatedAt cutoff
    expect(call.where.OR[0].status.in).toContain("closed");
    expect(call.where.OR[0].status.in).toContain("lost");
    // new/contacted with updatedAt cutoff
    expect(call.where.OR[1].status.in).toContain("new");
    expect(call.where.OR[1].status.in).toContain("contacted");
  });
});

// ── deleteExpiredSessions ─────────────────────────────────────────────

describe("deleteExpiredSessions", () => {
  it("deletes sessions expired more than 7 days ago", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = { session: { deleteMany } } as unknown as import("@prisma/client").PrismaClient;

    const count = await deleteExpiredSessions(prisma);
    expect(count).toBe(2);

    const call = deleteMany.mock.calls[0][0];
    expect(call.where.expiresAt.lte).toBeInstanceOf(Date);
  });
});

// ── deleteExpiredVerifications ────────────────────────────────────────

describe("deleteExpiredVerifications", () => {
  it("deletes verifications past expiry", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { verification: { deleteMany } } as unknown as import("@prisma/client").PrismaClient;

    const count = await deleteExpiredVerifications(prisma);
    expect(count).toBe(1);
  });
});

// ── deleteExpiredInvitations ──────────────────────────────────────────

describe("deleteExpiredInvitations", () => {
  it("deletes invitations expired more than 90 days ago", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = { invitation: { deleteMany } } as unknown as import("@prisma/client").PrismaClient;

    const count = await deleteExpiredInvitations(prisma);
    expect(count).toBe(3);
  });
});

// ── runTenantRetention (aggregator) ───────────────────────────────────

describe("runTenantRetention", () => {
  it("runs all four tenant-scoped retention steps and aggregates counts", async () => {
    const db = mockScopedDb({
      guestSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      notificationLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      domainEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 12 }),
      },
      auditEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
      },
    });

    const result = await runTenantRetention(db, "venue-1");
    expect(result.tenantId).toBe("venue-1");
    expect(result.anonymizedSessions).toBe(3);
    expect(result.truncatedNotifications).toBe(5);
    expect(result.deletedEvents).toBe(12);
    expect(result.deletedAuditEntries).toBe(7);
    expect(result.errors).toHaveLength(0);
  });

  it("catches errors per step without failing the full run", async () => {
    const db = mockScopedDb({
      guestSession: {
        updateMany: vi.fn().mockRejectedValue(new Error("connection lost")),
      },
      notificationLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      domainEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    const result = await runTenantRetention(db, "venue-err");
    expect(result.anonymizedSessions).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("guest-sessions");
    expect(result.errors[0]).toContain("connection lost");
  });
});
