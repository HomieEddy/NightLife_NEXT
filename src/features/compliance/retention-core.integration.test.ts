import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getDb, type SessionContext } from "@/features/shared/db";
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

describe("retention-core (integration)", () => {
  let testDb: TestDb;
  let rawPrisma: PrismaClient;
  const orgId = "venue-ret-1";
  const ctx: SessionContext = { venueId: orgId };

  beforeAll(async () => {
    testDb = await createTestDb();
    rawPrisma = testDb.rawClient;

    await rawPrisma.organization.create({
      data: { id: orgId, name: "Retention Org", slug: "retention-org" },
    });
    await rawPrisma.venue.create({
      data: {
        id: orgId, address: "1 Test St", city: "Testville", timezone: "UTC",
        currency: "CAD", openingHours: [], serviceFees: [], slaThresholds: {
          orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8,
        },
        floorMap: { width: 16, height: 9 }, autoApproveGuests: false, logoInitials: "RT",
        lastCallAutoFlagTables: true,
      },
    });
    await rawPrisma.tenant.create({
      data: { id: orgId, name: "Retention Test", slug: "retention-test", plan: "starter", status: "active" },
    });
    // User needed for Session FK
    await rawPrisma.user.create({
      data: { id: "u-ret", name: "Ret User", email: "ret@test.com", emailVerified: true },
    });
  }, 60_000);

  afterAll(async () => { await testDb?.teardown(); });

  // ── anonymizeClosedGuestSessions ────────────────────────────────────

  describe("anonymizeClosedGuestSessions", () => {
    it("anonymizes old closed sessions, leaves fresh and open ones untouched", async () => {
      const db = getDb(ctx);

      const profile = await rawPrisma.guestProfile.create({
        data: {
          id: "gp-ret", venueId: orgId, displayName: "Jean Dupont",
          firstName: "Jean", phone: "555-0100",
        },
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);

      await rawPrisma.guestSession.create({
        data: {
          id: "sess-old", venueId: orgId, tableId: "tbl-a1", tableCode: "A1",
          zoneName: "Main", displayName: "Jean", guestProfileId: profile.id,
          status: "closed", partySize: 2,
        },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "guest_sessions" SET "updated_at" = $1::timestamptz WHERE id = $2`,
        oldDate, "sess-old",
      );

      await rawPrisma.guestSession.create({
        data: {
          id: "sess-fresh", venueId: orgId, tableId: "tbl-a2", tableCode: "A2",
          zoneName: "Main", displayName: "Marie", guestProfileId: profile.id,
          status: "closed", partySize: 2,
        },
      });

      await rawPrisma.guestSession.create({
        data: {
          id: "sess-open-old", venueId: orgId, tableId: "tbl-a3", tableCode: "A3",
          zoneName: "Main", displayName: "Pierre", guestProfileId: profile.id,
          status: "approved", partySize: 3,
        },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "guest_sessions" SET "updated_at" = $1::timestamptz WHERE id = $2`,
        oldDate, "sess-open-old",
      );

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      const count = await anonymizeClosedGuestSessions(db, cutoff);
      expect(count).toBeGreaterThanOrEqual(1);

      const oldAfter = await rawPrisma.guestSession.findUnique({ where: { id: "sess-old" } });
      expect(oldAfter?.displayName).toBe("");
      expect(oldAfter?.guestProfileId).toBeNull();

      const freshAfter = await rawPrisma.guestSession.findUnique({ where: { id: "sess-fresh" } });
      expect(freshAfter?.displayName).toBe("Marie");
      expect(freshAfter?.guestProfileId).toBe(profile.id);

      const openAfter = await rawPrisma.guestSession.findUnique({ where: { id: "sess-open-old" } });
      expect(openAfter?.displayName).toBe("Pierre");
      expect(openAfter?.guestProfileId).toBe(profile.id);
    });

    it("is idempotent — re-running returns 0 for already-anonymized rows", async () => {
      const db = getDb(ctx);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      const count = await anonymizeClosedGuestSessions(db, cutoff);
      expect(count).toBe(0);
    });
  });

  // ── truncateNotificationLogs ────────────────────────────────────────

  describe("truncateNotificationLogs", () => {
    it("truncates old notification recipients, leaves fresh ones", async () => {
      const db = getDb(ctx);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);

      await rawPrisma.notificationLog.create({
        data: {
          id: "nl-old", venueId: orgId, channel: "sms", template: "order-update",
          recipient: "555-0100", status: "sent",
        },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "notification_logs" SET "created_at" = $1::timestamptz WHERE id = $2`,
        oldDate, "nl-old",
      );

      await rawPrisma.notificationLog.create({
        data: {
          id: "nl-fresh", venueId: orgId, channel: "email", template: "order-update",
          recipient: "jean@example.com", status: "sent",
        },
      });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const count = await truncateNotificationLogs(db, cutoff);
      expect(count).toBeGreaterThanOrEqual(1);

      const oldAfter = await rawPrisma.notificationLog.findUnique({ where: { id: "nl-old" } });
      expect(oldAfter?.recipient).toBe("");

      const freshAfter = await rawPrisma.notificationLog.findUnique({ where: { id: "nl-fresh" } });
      expect(freshAfter?.recipient).toBe("jean@example.com");
    });

    it("never touches another tenant's logs", async () => {
      const otherOrgId = "venue-ret-2";
      await rawPrisma.organization.create({
        data: { id: otherOrgId, name: "Retention Org 2", slug: "retention-org-2" },
      });
      await rawPrisma.venue.create({
        data: {
          id: otherOrgId, address: "2 Test St", city: "Testville", timezone: "UTC",
          currency: "CAD", openingHours: [], serviceFees: [], slaThresholds: {
            orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8,
          },
          floorMap: { width: 16, height: 9 }, autoApproveGuests: false, logoInitials: "R2",
          lastCallAutoFlagTables: true,
        },
      });
      await rawPrisma.tenant.create({
        data: { id: otherOrgId, name: "Retention Test 2", slug: "retention-test-2", plan: "starter", status: "active" },
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);
      await rawPrisma.notificationLog.create({
        data: {
          id: "nl-other", venueId: otherOrgId, channel: "sms", template: "order-update",
          recipient: "999-9999", status: "sent",
        },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "notification_logs" SET "created_at" = $1::timestamptz WHERE id = $2`,
        oldDate, "nl-other",
      );

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      await truncateNotificationLogs(getDb(ctx), cutoff);

      const otherAfter = await rawPrisma.notificationLog.findUnique({ where: { id: "nl-other" } });
      expect(otherAfter?.recipient).toBe("999-9999");
    });
  });

  // ── deleteOldDomainEvents ───────────────────────────────────────────

  describe("deleteOldDomainEvents", () => {
    it("deletes domain events older than cutoff", async () => {
      const db = getDb(ctx);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await rawPrisma.domainEvent.create({
        data: { id: "de-old", venueId: orgId, type: "test", payload: {} },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "domain_events" SET "created_at" = $1::timestamptz WHERE id = $2`,
        oldDate, "de-old",
      );

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const count = await deleteOldDomainEvents(db, cutoff);
      expect(count).toBeGreaterThanOrEqual(1);

      const gone = await rawPrisma.domainEvent.findUnique({ where: { id: "de-old" } });
      expect(gone).toBeNull();
    });
  });

  // ── deleteOldAuditEntries ───────────────────────────────────────────

  describe("deleteOldAuditEntries", () => {
    it("deletes audit entries older than 12 months", async () => {
      const db = getDb(ctx);
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 13);

      await rawPrisma.auditEntry.create({
        data: {
          id: "ae-old", venueId: orgId, action: "test",
          actorStaffId: "staff-1", actorName: "Staff One",
          targetType: "order", targetId: "ord-1", summary: "Test entry",
        },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "audit_entries" SET "created_at" = $1::timestamptz WHERE id = $2`,
        oldDate, "ae-old",
      );

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 12);
      const count = await deleteOldAuditEntries(db, cutoff);
      expect(count).toBeGreaterThanOrEqual(1);

      const gone = await rawPrisma.auditEntry.findUnique({ where: { id: "ae-old" } });
      expect(gone).toBeNull();
    });
  });

  // ── Platform-scope functions ────────────────────────────────────────

  describe("purgeStaleLeads", () => {
    it("deletes leads past retention windows", async () => {
      const oldClosed = new Date();
      oldClosed.setMonth(oldClosed.getMonth() - 13);

      await rawPrisma.lead.create({
        data: {
          id: "lead-old-closed", email: "old@test.com", source: "demo",
          status: "closed", venueName: "Test Venue", contactName: "Jean",
        },
      });
      await rawPrisma.$executeRawUnsafe(
        `UPDATE "leads" SET "updated_at" = $1::timestamptz WHERE id = $2`,
        oldClosed, "lead-old-closed",
      );

      const count = await purgeStaleLeads(rawPrisma);
      expect(count).toBeGreaterThanOrEqual(1);

      const gone = await rawPrisma.lead.findUnique({ where: { id: "lead-old-closed" } });
      expect(gone).toBeNull();
    });
  });

  describe("deleteExpiredSessions", () => {
    it("deletes auth sessions expired over 7 days ago", async () => {
      const oldExpiry = new Date();
      oldExpiry.setDate(oldExpiry.getDate() - 10);

      await rawPrisma.session.create({
        data: {
          id: "as-old", token: "tok-dead-ret", userId: "u-ret", ipAddress: "1.1.1.1",
          expiresAt: oldExpiry,
        },
      });

      const count = await deleteExpiredSessions(rawPrisma);
      expect(count).toBeGreaterThanOrEqual(1);

      const gone = await rawPrisma.session.findUnique({ where: { id: "as-old" } });
      expect(gone).toBeNull();
    });
  });

  describe("deleteExpiredVerifications", () => {
    it("deletes verifications past expiry", async () => {
      const oldExpiry = new Date();
      oldExpiry.setHours(oldExpiry.getHours() - 1);

      await rawPrisma.verification.create({
        data: { id: "verif-old", identifier: "test@test.com", value: "123456", expiresAt: oldExpiry },
      });

      const count = await deleteExpiredVerifications(rawPrisma);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("deleteExpiredInvitations", () => {
    it("deletes invitations expired over 90 days ago", async () => {
      const oldExpiry = new Date();
      oldExpiry.setDate(oldExpiry.getDate() - 100);

      const org = await rawPrisma.organization.findFirst();
      await rawPrisma.invitation.create({
        data: {
          id: "inv-old", email: "invitee@test.com", role: "member",
          organizationId: org!.id, inviterId: "u-ret",
          expiresAt: oldExpiry,
        },
      });

      const count = await deleteExpiredInvitations(rawPrisma);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ── runTenantRetention (aggregator) ─────────────────────────────────

  describe("runTenantRetention", () => {
    it("aggregates all per-tenant steps and reports counts", async () => {
      const db = getDb(ctx);
      const result = await runTenantRetention(db, orgId);

      expect(result.tenantId).toBe(orgId);
      expect(typeof result.anonymizedSessions).toBe("number");
      expect(typeof result.truncatedNotifications).toBe("number");
      expect(typeof result.deletedEvents).toBe("number");
      expect(typeof result.deletedAuditEntries).toBe("number");
    });

    it("returns empty errors array when all steps succeed", async () => {
      const db = getDb(ctx);
      const result = await runTenantRetention(db, orgId);
      expect(result.errors).toEqual([]);
    });

    it("is idempotent — second run against same data returns zero counts", async () => {
      const db = getDb(ctx);
      const result = await runTenantRetention(db, orgId);

      expect(result.anonymizedSessions).toBe(0);
    });
  });
});
