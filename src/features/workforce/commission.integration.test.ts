import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  listCommissionRules,
  saveCommissionRule,
  listCommissionStatements,
  saveCommissionStatement,
  approveCommissionStatement,
} from "@/features/workforce/commission-core";
import type { CommissionRule, CommissionStatement } from "@/lib/types";

async function makeVenue(prisma: PrismaClient, id: string) {
  await prisma.organization.create({ data: { id, name: id, slug: id } });
  await prisma.venue.create({
    data: {
      id, address: "1 Test", city: "Test", timezone: "UTC", currency: "USD",
      openingHours: [], serviceFees: [], floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
}

describe("commission integration (plan 18, WS-4)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "comm-venue-a";
  const venueB = "comm-venue-b";
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("creates a commission rule and lists it for the staff member it targets", async () => {
    const db = getDb(sessionA);
    const rule: CommissionRule = {
      id: "cr-1", venueId: venueA, staffId: "st-julien",
      basis: "net-revenue", ratePct: 10,
    };
    await saveCommissionRule(db, rule);

    const forStaff = await listCommissionRules(db, "st-julien");
    expect(forStaff.length).toBe(1);
    expect(forStaff[0].ratePct).toBe(10);
  });

  it("upserts a rule in place rather than duplicating it", async () => {
    const db = getDb(sessionA);
    await saveCommissionRule(db, {
      id: "cr-1", venueId: venueA, staffId: "st-julien",
      basis: "net-revenue", ratePct: 15,
    });

    const rows = await prisma.commissionRule.findMany({ where: { venueId: venueA } });
    expect(rows.length).toBe(1);
    expect(rows[0].ratePct).toBe(15);
  });

  it("saves a statement in draft and lists it for the staff member", async () => {
    const db = getDb(sessionA);
    const stmt: CommissionStatement = {
      id: "stmt-1", venueId: venueA, staffId: "st-julien",
      periodStart: "2026-08-01T00:00:00Z", periodEnd: "2026-08-07T23:59:59Z",
      lines: [{ sourceType: "reservation", sourceId: "res-1", basisCents: 42000, earnedCents: 4200 }],
      totalCents: 4200, status: "draft",
    };
    await saveCommissionStatement(db, stmt);

    const list = await listCommissionStatements(db, "st-julien");
    expect(list.length).toBe(1);
    expect(list[0].status).toBe("draft");
    expect(list[0].totalCents).toBe(4200);
  });

  it("approving a draft statement stamps the approver and flips status", async () => {
    const db = getDb(sessionA);
    const approved = await approveCommissionStatement(db, "stmt-1", "st-owner");
    expect(approved.status).toBe("approved");
    expect(approved.approvedByStaffId).toBe("st-owner");
  });

  it("rejects approving a statement that is already approved", async () => {
    const db = getDb(sessionA);
    await expect(approveCommissionStatement(db, "stmt-1", "st-owner-2")).rejects.toThrow(
      "Statement is not in draft status.",
    );
  });

  it("rejects approving a statement that does not exist", async () => {
    const db = getDb(sessionA);
    await expect(approveCommissionStatement(db, "no-such-id", "st-owner")).rejects.toThrow(
      "Statement not found.",
    );
  });

  it("a tenant cannot approve another venue's commission statement", async () => {
    await saveCommissionStatement(getDb({ venueId: venueB }), {
      id: "stmt-b1", venueId: venueB, staffId: "st-other",
      periodStart: "2026-08-01T00:00:00Z", periodEnd: "2026-08-07T23:59:59Z",
      lines: [], totalCents: 0, status: "draft",
    });

    // approveCommissionStatement looks the row up by id via the venue-scoped
    // client — from venueA's session it must not find venueB's statement.
    await expect(approveCommissionStatement(getDb(sessionA), "stmt-b1", "st-mgr")).rejects.toThrow(
      "Statement not found.",
    );
  });

  it("a tenant cannot list another venue's commission rules", async () => {
    await expectTenantIsolation(venueA, venueB, async (scoped) => {
      const rows = await scoped.commissionRule.findFirst({ where: { id: "cr-1" } });
      return rows;
    });
  });
});
