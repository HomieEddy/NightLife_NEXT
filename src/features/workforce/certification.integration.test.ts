import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  listCertifications,
  getCertification,
  createCertification,
  updateCertification,
  revokeCertification,
  verifyCertification,
} from "@/features/workforce/certification-core";

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Montreal",
      currency: "CAD",
      openingHours: [],
      serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: {
        orderWarnMinutes: 6,
        orderCriticalMinutes: 12,
        helpWarnMinutes: 4,
        helpCriticalMinutes: 8,
      },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

const future = new Date(Date.now() + 365 * 24 * 3600_000).toISOString();
const past = new Date(Date.now() - 24 * 3600_000).toISOString();

describe("certification integration (S-04, plan 17)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Venue A", "cert-a");
    venueB = await makeVenue(rawClient, "Venue B", "cert-b");
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("creates a certification and lists it back", async () => {
    const db = getDb(sessionA);
    const cert = await createCertification(db, venueA, {
      staffId: "st-1",
      type: "smart-serve",
      issuedAt: new Date().toISOString(),
      expiresAt: future,
      issuingBody: "AGCO",
      referenceNumber: "SS-1234",
      createdByStaffId: "st-mgr",
    });

    expect(cert.status).toBe("active");
    expect(cert.verifiedByStaffId).toBe("st-mgr");

    const list = await listCertifications(db);
    expect(list.some((c) => c.id === cert.id)).toBe(true);

    const fetched = await getCertification(db, cert.id);
    expect(fetched?.referenceNumber).toBe("SS-1234");
  });

  it("filters by staff", async () => {
    const db = getDb(sessionA);
    await createCertification(db, venueA, {
      staffId: "st-2",
      type: "first-aid",
      issuedAt: new Date().toISOString(),
      expiresAt: future,
      createdByStaffId: "st-mgr",
    });

    const forStaff2 = await listCertifications(db, "st-2");
    expect(forStaff2.length).toBe(1);
    expect(forStaff2[0].staffId).toBe("st-2");
  });

  it("derives expired from the date, not from the stored column", async () => {
    const db = getDb(sessionA);
    const cert = await createCertification(db, venueA, {
      staffId: "st-3",
      type: "security-guard",
      issuedAt: past,
      expiresAt: past,
      createdByStaffId: "st-mgr",
    });
    expect(cert.status).toBe("expired");

    // Force the column to lie; the derived status must still read "expired".
    await rawClient.certification.update({ where: { id: cert.id }, data: { status: "active" } });
    const reread = await getCertification(db, cert.id);
    expect(reread?.status).toBe("expired");
  });

  it("renewing an expiry reactivates the certification", async () => {
    const db = getDb(sessionA);
    const cert = await createCertification(db, venueA, {
      staffId: "st-4",
      type: "food-handler",
      issuedAt: past,
      expiresAt: past,
      createdByStaffId: "st-mgr",
    });
    expect(cert.status).toBe("expired");

    const renewed = await updateCertification(db, cert.id, { expiresAt: future });
    expect(renewed?.status).toBe("active");
  });

  it("a revoked certification stays revoked even when renewed", async () => {
    const db = getDb(sessionA);
    const cert = await createCertification(db, venueA, {
      staffId: "st-5",
      type: "crowd-manager",
      issuedAt: new Date().toISOString(),
      expiresAt: future,
      createdByStaffId: "st-mgr",
    });

    const revoked = await revokeCertification(db, cert.id);
    expect(revoked?.status).toBe("revoked");

    // Renewing the date must not silently restore a revoked credential.
    const renewed = await updateCertification(db, cert.id, { expiresAt: future });
    expect(renewed?.status).toBe("revoked");
  });

  it("records who verified a certification and when", async () => {
    const db = getDb(sessionA);
    const cert = await createCertification(db, venueA, {
      staffId: "st-6",
      type: "smart-serve",
      issuedAt: new Date().toISOString(),
      expiresAt: future,
      createdByStaffId: "st-mgr",
    });

    const verified = await verifyCertification(db, cert.id, "st-owner");
    expect(verified?.verifiedByStaffId).toBe("st-owner");
    expect(verified?.verifiedAt).toBeTruthy();
  });

  it("returns null for a certification in another tenant", async () => {
    const db = getDb(sessionA);
    const cert = await createCertification(db, venueA, {
      staffId: "st-7",
      type: "first-aid",
      issuedAt: new Date().toISOString(),
      expiresAt: future,
      createdByStaffId: "st-mgr",
    });

    await expectTenantIsolation(venueA, venueB, (scoped) =>
      getCertification(scoped, cert.id),
    );
  });
});
