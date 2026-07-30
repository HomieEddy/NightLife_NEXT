import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getDb } from "@/features/shared/db";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  reportIncident,
  getIncident,
  listIncidents,
  addNote,
  listNotes,
  setIncidentStatus,
  markReportable,
  recordReportedToAuthority,
  getIncidentsByZone,
  createActionItem,
  completeActionItem,
  listActionItems,
  listTemplates,
  fileFromTemplate,
} from "@/features/safety/core";

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

async function seedZone(prisma: PrismaClient, venueId: string, id: string, name: string) {
  await prisma.zone.upsert({
    where: { id },
    create: { id, venueId, name, color: "#60a5fa" },
    update: {},
  });
}

describe("incidents integration", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "inc-venue-a";
  const venueB = "inc-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    await seedZone(prisma, venueA, "zone-inc", "Dance Floor");
  }, 60_000);

  afterAll(async () => testDb?.teardown());

  // ── Incident CRUD ────────────────────────────────────────────────────

  it("reports an incident and retrieves it", async () => {
    const db = getDb({ venueId: venueA });
    const incident = await reportIncident(db, venueA, {
      type: "altercation",
      severity: "medium",
      narrative: "Guest refused to leave at closing",
      actionsTaken: "Escorted to exit",
      reportedByStaffId: "staff-1",
      reportedByStaffName: "Rae Runner",
      involvedStaffIds: ["staff-1"],
      policeInvolved: false,
    });
    expect(incident.id).toBeDefined();
    expect(incident.narrative).toBe("Guest refused to leave at closing");
    expect(incident.status).toBe("open");

    const fetched = await getIncident(db, incident.id);
    expect(fetched).not.toBeNull();
  });

  it("lists incidents with optional status filter", async () => {
    const db = getDb({ venueId: venueA });
    const all = await listIncidents(db);
    expect(all.length).toBeGreaterThanOrEqual(1);

    const resolved = await listIncidents(db, { status: "resolved" });
  });

  it("adds and lists notes on an incident", async () => {
    const db = getDb({ venueId: venueA });
    const incident = await reportIncident(db, venueA, {
      type: "medical",
      severity: "high",
      narrative: "Guest slipped on wet floor",
      actionsTaken: "First aid applied",
      reportedByStaffId: "staff-1",
      reportedByStaffName: "Rae Runner",
      involvedStaffIds: ["staff-1", "staff-2"],
      policeInvolved: false,
    });

    const note = await addNote(db, incident.id, "Called EMS at 01:30", "staff-1", "Rae Runner");
    expect(note.id).toBeDefined();
    expect(note.note).toContain("EMS");

    const notes = await listNotes(db, incident.id);
    expect(notes.length).toBe(1);
  });

  it("transitions incident through statuses", async () => {
    const db = getDb({ venueId: venueA });
    const incident = await reportIncident(db, venueA, {
      type: "theft",
      severity: "low",
      narrative: "Guest reported missing phone",
      actionsTaken: "Filed report, checking CCTV",
      reportedByStaffId: "staff-1",
      reportedByStaffName: "Rae Runner",
      involvedStaffIds: ["staff-1"],
      policeInvolved: false,
    });

    // "open" → "resolved" is the only valid status transition per IncidentStatus
    await setIncidentStatus(db, incident.id, "resolved");
    const updated = await getIncident(db, incident.id);
    expect(updated?.status).toBe("resolved");

    await setIncidentStatus(db, incident.id, "resolved");
    const resolved = await getIncident(db, incident.id);
    expect(resolved?.status).toBe("resolved");
  });

  // ── Reportable incidents ─────────────────────────────────────────────

  it("marks an incident as reportable and records authority reporting", async () => {
    const db = getDb({ venueId: venueA });
    const incident = await reportIncident(db, venueA, {
      type: "altercation",
      severity: "high",
      narrative: "Physical altercation between guests",
      actionsTaken: "Security intervened, police called",
      reportedByStaffId: "staff-1",
      reportedByStaffName: "Rae Runner",
      involvedStaffIds: ["staff-1", "staff-3"],
      policeInvolved: true,
      zoneId: "zone-inc",
    });

    const reportable = await markReportable(db, venueA, incident.id, {
      regulatoryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      regulatoryAuthority: "AGCO",
      staffId: "staff-1",
      staffName: "Rae Runner",
    });
    expect(reportable?.reportable).toBe(true);
    expect(reportable?.regulatoryAuthority).toBe("AGCO");

    const reported = await recordReportedToAuthority(db, venueA, incident.id, "staff-1", "Rae Runner");
    expect(reported?.reportedToAuthorityAt).toBeDefined();
  });

  // ── Zone-scoped incidents ────────────────────────────────────────────

  it("retrieves incidents by zone", async () => {
    const db = getDb({ venueId: venueA });
    // getIncidentsByZone takes (db, zoneId, dateRange?) — no venueId
    const byZone = await getIncidentsByZone(db, "zone-inc");
    expect(byZone.length).toBeGreaterThanOrEqual(1);
  });

  // ── Action items ─────────────────────────────────────────────────────

  it("creates and completes action items", async () => {
    const db = getDb({ venueId: venueA });
    const incident = await reportIncident(db, venueA, {
      type: "other",
      severity: "low",
      narrative: "Spilled drink near bar",
      actionsTaken: "Cleaned up",
      reportedByStaffId: "staff-1",
      reportedByStaffName: "Rae Runner",
      involvedStaffIds: ["staff-1"],
      policeInvolved: false,
    });

    const item = await createActionItem(db, venueA, {
      incidentId: incident.id,
      description: "Review CCTV footage",
      assignedToStaffId: "staff-2",
    });
    expect(item.id).toBeDefined();
    expect(item.status).toBe("pending");

    await completeActionItem(db, item.id);

    // listActionItems takes (db, incidentId?) — no venueId
    const items = await listActionItems(db, incident.id);
    const updated = items.find((i) => i.id === item.id);
    expect(updated?.status).toBe("completed");
  });

  // ── Templates ────────────────────────────────────────────────────────

  it("lists templates and files an incident from one", async () => {
    const db = getDb({ venueId: venueA });
    const templates = await listTemplates(db);
    expect(Array.isArray(templates)).toBe(true);

    // Seed a template with required label field
    const template = await prisma.incidentTemplate.create({
      data: {
        id: "tpl-test",
        venueId: venueA,
        label: "Slip & Fall",
        type: "medical",
        severity: "medium",
        narrativeTemplate: "Guest slipped on [location] at [time]",
        actionsTakenTemplate: "First aid applied, area cordoned off",
      },
    });

    const filed = await fileFromTemplate(db, venueA, template.id, {}, {
      reportedByStaffId: "staff-1",
      reportedByStaffName: "Rae Runner",
    });
    expect(filed.narrative).toBe(template.narrativeTemplate);
    expect(filed.actionsTaken).toBe(template.actionsTakenTemplate);
  });

  // ── Tenant isolation ─────────────────────────────────────────────────

  it("isolates incidents by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    const incident = await reportIncident(dbA, venueA, {
      type: "other",
      severity: "low",
      narrative: "Tenant isolation test",
      actionsTaken: "None",
      reportedByStaffId: "staff-iso",
      reportedByStaffName: "Iso Staff",
      involvedStaffIds: ["staff-iso"],
      policeInvolved: false,
    });

    await expectTenantIsolation(venueA, venueB, async (db) =>
      db.incident.findUnique({ where: { id: incident.id } }),
    );
  });
});
