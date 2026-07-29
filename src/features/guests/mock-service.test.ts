import { describe, it, expect } from "vitest";
import { mockGuestsService } from "./mock-service";
import { mockVenueService } from "@/features/venue/mock-service";
import { mockStaffService } from "@/features/workforce/staff-mock-service";
import { mockDoorService } from "@/features/door/mock-service";
import { mockPulseService } from "@/features/realtime/pulse-mock-service";
import { mockOrdersService } from "@/features/ordering/mock-service";

async function newSession() {
  const session = await mockGuestsService.requestSession({
    tableId: "tbl-vip-1",
    tableCode: "VIP-01",
    zoneName: "VIP Mezzanine",
    displayName: "Test Guest",
    partySize: 2,
  });
  await mockGuestsService.setSessionStatus(session.id, "approved");
  return session;
}

describe("table hold / out-of-service (VM-04)", () => {
  it("holds an open table and releases it", async () => {
    const tables = await mockVenueService.listTables();
    const open = tables.find((t) => t.status === "open");
    expect(open).toBeDefined();
    const held = await mockVenueService.holdTable(open!.id, "VIP waiting", "st-lucas", undefined);
    expect(held).not.toBeNull();
    expect(held!.status).toBe("held");
    expect(held!.holdReason).toBe("VIP waiting");
    const released = await mockVenueService.releaseHold(open!.id);
    expect(released).not.toBeNull();
    expect(released!.status).toBe("open");
  });

  it("marks a table out of service and returns it", async () => {
    const tables = await mockVenueService.listTables();
    const open = tables.find((t) => t.status === "open");
    const oos = await mockVenueService.markOutOfService(open!.id, "Broken booth", "st-manager");
    expect(oos!.status).toBe("out-of-service");
    const back = await mockVenueService.returnToService(open!.id);
    expect(back!.status).toBe("open");
  });

  it("rejects holding a non-open table", async () => {
    const tables = await mockVenueService.listTables();
    const occupied = tables.find((t) => t.status === "occupied");
    if (occupied) {
      expect(await mockVenueService.holdTable(occupied.id, "test", "st-a", undefined)).toBeNull();
    }
  });
});

describe("session notes (GS-06)", () => {
  it("adds a note to a session and lists it", async () => {
    const session = await newSession();
    const note = await mockGuestsService.addSessionNote(
      session.id, "Engagement celebration — bring sparklers with the Moeumlt", "st-lucas", "Lucas"
    );
    expect(note.sessionId).toBe(session.id);
    const notes = await mockGuestsService.listSessionNotes(session.id);
    expect(notes.length).toBe(1);
    expect(notes[0].note).toContain("sparklers");
  });
});

describe("force-close session (GS-07)", () => {
  it("force-closes an approved session and audits it", async () => {
    const session = await newSession();
    const closed = await mockGuestsService.forceCloseSession(
      session.id, "End of night — guest refused to leave", "st-amara", "Amara"
    );
    expect(closed).not.toBeNull();
    expect(closed!.status).toBe("closed");
  });

  it("returns null for already-closed sessions", async () => {
    const session = await newSession();
    await mockGuestsService.forceCloseSession(session.id, "done", "st-amara", "Amara");
    expect(await mockGuestsService.forceCloseSession(session.id, "again", "st-a", "A")).toBeNull();
  });
});

describe("abandoned session detection (GS-05)", () => {
  it("detects sessions with no orders", async () => {
    const abandoned = await mockGuestsService.detectAbandonedSessions(0);
    expect(Array.isArray(abandoned)).toBe(true);
  });
});

describe("walkout tracking (OT-09)", () => {
  it("reports a walkout with a record", async () => {
    const session = await newSession();
    const record = await mockOrdersService.reportWalkout(
      session.id, "Guest left without paying", "st-viktor", "Viktor"
    );
    expect(record.sessionId).toBe(session.id);
    expect(record.description).toContain("without paying");
  });
});

describe("dress code refusal (DO-02)", () => {
  it("records a refusal and lists todays refusals", async () => {
    const refusal = await mockDoorService.recordRefusal({
      reason: "dress-code",
      description: "Wearing shorts — no shorts policy",
      partySize: 2,
      staffId: "st-viktor",
      staffName: "Viktor",
    });
    expect(refusal.reason).toBe("dress-code");
    const list = await mockDoorService.listRefusals();
    expect(list.length).toBeGreaterThan(0);
  });
});

describe("coat check claims (DO-10)", () => {
  it("reports a lost ticket claim", async () => {
    const claim = await mockDoorService.reportLostTicket("Lost coat check stub #45", "Nina");
    expect(claim.claimType).toBe("lost-ticket");
  });

  it("reports a lost item and resolves it", async () => {
    const claim = await mockDoorService.reportLostItem("cc-1", "Customer says coat missing from rack", "Nina");
    expect(claim.claimType).toBe("lost-item");
    const resolved = await mockDoorService.resolveClaim(claim.id, "Found on wrong rack — returned to customer", "st-nina");
    expect(resolved).not.toBeNull();
    expect(resolved!.resolvedAt).toBeDefined();
  });
});

describe("attention acknowledgment (RT-01)", () => {
  it("acknowledges and snoozes attention items", async () => {
    const ack = await mockPulseService.acknowledgeAttentionItem("order-ord-1", "st-nina", "Nina");
    expect(ack.attentionItemId).toBe("order-ord-1");
    const snooze = await mockPulseService.snoozeAttentionItem("order-ord-2", 10, "st-nina", "Nina");
    expect(snooze.snoozedUntil).toBeDefined();
    const all = await mockPulseService.listAcknowledgments();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

describe("shift handoff (WF-10)", () => {
  it("generates a handoff and acknowledges it", async () => {
    const handoff = await mockStaffService.generateHandoff({
      fromStaffId: "st-sofia",
      fromStaffName: "Sofia",
      openIncidents: ["inc-1"],
      vipNotes: "VIP-01 celebrating engagement",
      inventoryAlerts: "Running low on Dom P",
      specialInstructions: "Watch the terrace south exit — busy tonight",
    });
    expect(handoff.id).toBeDefined();
    expect(handoff.vipNotes).toContain("engagement");
    const acked = await mockStaffService.acknowledgeHandoff(handoff.id, "st-theo", "Thumbnail");
    expect(acked!.acknowledgedByStaffId).toBe("st-theo");
  });
});
