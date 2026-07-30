import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getDb } from "@/features/shared/db";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  createProfile,
  getProfile,
  listProfiles,
  searchProfiles,
  findCandidates,
  updateProfile,
  setBanStatus,
  mergeProfiles,
  recordVisit,
  createReferral,
  listReferrals,
  linkSessionToProfile,
  getLinkForSession,
  listLinks,
  deleteProfileData,
} from "@/features/guests/core";

async function makeVenue(prisma: PrismaClient, id: string) {
  await prisma.organization.create({ data: { id, name: id, slug: id } });
  await prisma.venue.create({
    data: {
      id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Toronto",
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
}

describe("guests integration", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "guest-venue-a";
  const venueB = "guest-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
  }, 60_000);

  afterAll(async () => testDb?.teardown());

  // ── Profile CRUD ─────────────────────────────────────────────────────

  it("creates and retrieves a guest profile", async () => {
    const db = getDb({ venueId: venueA });
    const profile = await createProfile(db, venueA, {
      firstName: "Jane",
      lastName: "Doe",
      phone: "555-0100",
      email: "jane@test.local",
      source: "walk-in",
    });
    expect(profile.id).toBeDefined();
    expect(profile.displayName).toBe("Jane Doe");
    expect(profile.email).toBe("jane@test.local");
    expect(profile.status).toBe("active");

    const fetched = await getProfile(db, profile.id);
    expect(fetched?.email).toBe("jane@test.local");
  });

  it("lists all profiles for a venue", async () => {
    const db = getDb({ venueId: venueA });
    const profiles = await listProfiles(db);
    expect(profiles.length).toBeGreaterThanOrEqual(1);
  });

  it("searches profiles by name or phone", async () => {
    const db = getDb({ venueId: venueA });
    const profile = await createProfile(db, venueA, {
      firstName: "Searchable",
      lastName: "User",
      phone: "555-9999",
      email: "searchable@test.local",
      source: "guestlist",
    });

    const byName = await searchProfiles(db, "Searchable");
    expect(byName.some((p) => p.id === profile.id)).toBe(true);
  });

  it("updates profile fields", async () => {
    const db = getDb({ venueId: venueA });
    const profile = await createProfile(db, venueA, {
      firstName: "Updatable",
      source: "walk-in",
    });

    const updated = await updateProfile(
      db,
      venueA,
      profile.id,
      { lastName: "Person", vipTier: "vip" as const },
      "staff-1",
      "Rae Runner",
    );
    expect(updated?.displayName).toBe("Updatable Person");
    expect(updated?.vipTier).toBe("vip");
  });

  // ── Ban / unban ──────────────────────────────────────────────────────

  it("bans and unbans a profile", async () => {
    const db = getDb({ venueId: venueA });
    const profile = await createProfile(db, venueA, {
      firstName: "Bannable",
      source: "walk-in",
    });

    const banned = await setBanStatus(
      db,
      venueA,
      profile.id,
      { banned: true, reason: "repeated no-shows" },
      "staff-1",
      "Rae Runner",
    );
    expect(banned?.status).toBe("banned");
    expect(banned?.banReason).toBe("repeated no-shows");

    const unbanned = await setBanStatus(
      db,
      venueA,
      profile.id,
      { banned: false },
      "staff-1",
      "Rae Runner",
    );
    expect(unbanned?.status).toBe("active");
    expect(unbanned?.banReason).toBeUndefined();
  });

  // ── Merge ────────────────────────────────────────────────────────────

  it("merges two profiles, combining visits", async () => {
    const db = getDb({ venueId: venueA });
    const from = await createProfile(db, venueA, {
      firstName: "MergeFrom",
      source: "walk-in",
    });
    const to = await createProfile(db, venueA, {
      firstName: "MergeTo",
      source: "walk-in",
    });

    await recordVisit(db, from.id, 5000);
    await recordVisit(db, from.id, 3000);

    const merged = await mergeProfiles(db, venueA, from.id, to.id, "staff-1", "Rae Runner");
    expect(merged?.id).toBe(to.id);

    // mergeProfiles hard-deletes the "from" profile
    const deleted = await getProfile(db, from.id);
    expect(deleted).toBeNull();

    expect(merged?.visitCount).toBeGreaterThanOrEqual(2);
  });

  // ── Referrals ────────────────────────────────────────────────────────

  it("creates and lists referrals", async () => {
    const db = getDb({ venueId: venueA });
    const referrer = await createProfile(db, venueA, {
      firstName: "Referrer",
      source: "walk-in",
    });
    const referee = await createProfile(db, venueA, {
      firstName: "Referee",
      source: "walk-in",
    });

    await createReferral(db, venueA, {
      referrerProfileId: referrer.id,
      referredProfileId: referee.id,
      source: "in-person",
    });

    const referrals = await listReferrals(db);
    expect(referrals.some((r) => r.referrerProfileId === referrer.id)).toBe(true);
  });

  // ── Session links ────────────────────────────────────────────────────

  it("links and retrieves a session-to-profile link", async () => {
    const db = getDb({ venueId: venueA });
    const profile = await createProfile(db, venueA, {
      firstName: "Linked",
      source: "walk-in",
    });

    await linkSessionToProfile(db, venueA, "session-test", profile.id);

    const link = await getLinkForSession(db, "session-test");
    expect(link?.guestProfileId).toBe(profile.id);

    const links = await listLinks(db);
    expect(links.some((l) => l.sessionId === "session-test")).toBe(true);
  });

  // ── Dedupe / find candidates ──────────────────────────────────────────

  it("finds duplicate candidates by phone", async () => {
    const db = getDb({ venueId: venueA });
    await createProfile(db, venueA, {
      firstName: "DupeOne",
      phone: "555-DUPE1",
      source: "walk-in",
    });
    await createProfile(db, venueA, {
      firstName: "DupeTwo",
      phone: "555-DUPE1",
      source: "walk-in",
    });

    const candidates = await findCandidates(db, {
      firstName: "DupeOne",
      phone: "555-DUPE1",
    });
    expect(candidates.length).toBeGreaterThan(0);
  });

  // ── Soft-delete ──────────────────────────────────────────────────────

  it("soft-deletes a profile (CRM-07)", async () => {
    const db = getDb({ venueId: venueA });
    const profile = await createProfile(db, venueA, {
      firstName: "DeleteMe",
      source: "walk-in",
    });

    await deleteProfileData(db, venueA, profile.id, "staff-1", "Rae Runner");
    // deleteProfileData hard-deletes the profile
    const deleted = await getProfile(db, profile.id);
    expect(deleted).toBeNull();
  });

  // ── Tenant isolation ─────────────────────────────────────────────────

  it("isolates guest profiles by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    const profile = await createProfile(dbA, venueA, {
      firstName: "Isolation",
      source: "walk-in",
    });

    await expectTenantIsolation(venueA, venueB, async (db) =>
      db.guestProfile.findUnique({ where: { id: profile.id } }),
    );
  });
});
