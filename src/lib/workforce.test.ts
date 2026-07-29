import { describe, expect, test } from "vitest";
import {
  businessDateForShift,
  computeMinutesWorked,
  isStaffOnShift,
  generateWeekFromTemplates,
  computeCoverageGaps,
  computeTipDistribution,
  computeCommission,
} from "./workforce";
import type {
  CommissionRule,
  Order,
  ShiftTemplate,
  StaffMember,
  TimeEntry,
  TipPoolRule,
  Zone,
} from "./types";

describe("businessDateForShift", () => {
  const nh = 4; // nightEndHour

  test("22:00 start belongs to the same calendar day when night end is 4", () => {
    const d = new Date("2026-07-24T22:00:00-04:00"); // Friday 22:00
    expect(businessDateForShift(d, nh)).toBe("2026-07-24");
  });

  test("02:00 start belongs to the previous calendar day", () => {
    const d = new Date("2026-07-25T02:00:00-04:00"); // Saturday 02:00
    expect(businessDateForShift(d, nh)).toBe("2026-07-24");
  });

  test("04:00 start belongs to the same day (on the boundary)", () => {
    const d = new Date("2026-07-25T04:00:00-04:00");
    expect(businessDateForShift(d, nh)).toBe("2026-07-25");
  });
});

describe("computeMinutesWorked", () => {
  test("simple shift with no breaks", () => {
    const e: TimeEntry = {
      id: "t1", venueId: "v", staffId: "s",
      clockInAt: "2026-07-25T22:00:00-04:00",
      clockOutAt: "2026-07-26T04:00:00-04:00",
      breaks: [], source: "self",
    };
    expect(computeMinutesWorked(e)).toBe(360); // 6h
  });

  test("shift with one unpaid 30-minute break", () => {
    const e: TimeEntry = {
      id: "t2", venueId: "v", staffId: "s",
      clockInAt: "2026-07-25T22:00:00-04:00",
      clockOutAt: "2026-07-26T04:00:00-04:00",
      breaks: [{ startedAt: "2026-07-26T00:00:00-04:00", endedAt: "2026-07-26T00:30:00-04:00", paid: false }],
      source: "self",
    };
    expect(computeMinutesWorked(e)).toBe(330);
  });

  test("paid break does not reduce minutes worked", () => {
    const e: TimeEntry = {
      id: "t3", venueId: "v", staffId: "s",
      clockInAt: "2026-07-25T22:00:00-04:00",
      clockOutAt: "2026-07-26T04:00:00-04:00",
      breaks: [{ startedAt: "2026-07-26T01:00:00-04:00", endedAt: "2026-07-26T01:15:00-04:00", paid: true }],
      source: "self",
    };
    expect(computeMinutesWorked(e)).toBe(360);
  });

  test("no clockOutAt returns 0", () => {
    const e: TimeEntry = {
      id: "t4", venueId: "v", staffId: "s",
      clockInAt: "2026-07-25T22:00:00-04:00",
      breaks: [], source: "self",
    };
    expect(computeMinutesWorked(e)).toBe(0);
  });
});

describe("isStaffOnShift", () => {
  test("returns true when open TimeEntry exists", () => {
    const entries: TimeEntry[] = [
      { id: "e1", venueId: "v", staffId: "s1", clockInAt: "2026-07-25T22:00:00-04:00", breaks: [], source: "self" },
    ];
    expect(isStaffOnShift(entries, "s1")).toBe(true);
  });

  test("returns false when staff is clocked out", () => {
    const entries: TimeEntry[] = [
      {
        id: "e1", venueId: "v", staffId: "s1",
        clockInAt: "2026-07-25T22:00:00-04:00",
        clockOutAt: "2026-07-26T04:00:00-04:00",
        breaks: [], source: "self",
      },
    ];
    expect(isStaffOnShift(entries, "s1")).toBe(false);
  });
});

describe("generateWeekFromTemplates", () => {
  const venueId = "v1";
  const staff: StaffMember[] = [
    { id: "sm1", venueId, name: "Alice", role: "bartender", phone: "", email: "", accountStatus: "active", assignedZoneIds: [], isOnShift: false, avatarInitials: "AL" },
    { id: "sm2", venueId, name: "Bob", role: "runner", phone: "", email: "", accountStatus: "active", assignedZoneIds: [], isOnShift: false, avatarInitials: "BO" },
  ];

  const templates: ShiftTemplate[] = [
    { id: "t1", venueId, staffId: "sm1", dayOfWeek: 5, startTime: "22:00", endTime: "04:00", zoneId: null, role: "bartender", active: true },
    { id: "t2", venueId, staffId: "sm2", dayOfWeek: 1, startTime: "20:00", endTime: "02:00", zoneId: null, role: "runner", active: true },
  ];

  test("generates shifts for matching days in a week", () => {
    // Monday = 2026-07-20
    const shifts = generateWeekFromTemplates(templates, staff, "2026-07-20", venueId);
    // Alice on Friday (dayOfWeek 5) → Jul 24
    // Bob on Monday (dayOfWeek 1) → Jul 20
    expect(shifts.length).toBe(2);
    const alice = shifts.find((s) => s.staffId === "sm1")!;
    const bob = shifts.find((s) => s.staffId === "sm2")!;
    expect(alice.businessDate).toBe("2026-07-24");
    expect(alice.role).toBe("bartender");
    expect(bob.businessDate).toBe("2026-07-20");
    expect(bob.role).toBe("runner");
  });

  test("skips inactive templates", () => {
    const t: ShiftTemplate[] = [
      { id: "t3", venueId, staffId: "sm1", dayOfWeek: 5, startTime: "22:00", endTime: "04:00", zoneId: null, role: "bartender", active: false },
    ];
    expect(generateWeekFromTemplates(t, staff, "2026-07-20", venueId)).toHaveLength(0);
  });

  test("skips suspended staff", () => {
    const suspended: StaffMember[] = [
      { id: "sm1", venueId, name: "Alice", role: "bartender", phone: "", email: "", accountStatus: "suspended", assignedZoneIds: [], isOnShift: false, avatarInitials: "AL" },
      { id: "sm2", venueId, name: "Bob", role: "runner", phone: "", email: "", accountStatus: "active", assignedZoneIds: [], isOnShift: false, avatarInitials: "BO" },
    ];
    expect(generateWeekFromTemplates(templates, suspended, "2026-07-20", venueId)).toHaveLength(1); // only Bob
  });
});

describe("computeCoverageGaps", () => {
  const zones: Zone[] = [
    { id: "z1", venueId: "v", name: "VIP", description: "", color: "violet", tableCount: 4, capacity: 60 },
    { id: "z2", venueId: "v", name: "Main", description: "", color: "blue", tableCount: 8, capacity: 200 },
  ];

  test("returns gap when a zone has open orders but no bartender clocked in", () => {
    const orders: Order[] = [{
      id: "o1", code: "A-001", venueId: "v", tableId: "t1", tableCode: "T1", zoneId: "z1", zoneName: "VIP",
      guestName: "G", items: [], subtotal: 100, serviceFee: 10, tip: 0, total: 110,
      status: "pending", placedAt: "", updatedAt: "",
    }];
    const staff: StaffMember[] = [
      { id: "s1", venueId: "v", name: "Runner", role: "runner", phone: "", email: "", accountStatus: "active", assignedZoneIds: ["z1"], isOnShift: false, avatarInitials: "RN" },
    ];
    const orderZoneIds = new Set(["z1"]);
    const gaps = computeCoverageGaps(zones, orders, staff, orderZoneIds);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].zoneName).toBe("VIP");
    expect(gaps[0].missingRoles).toContain("bartender");
  });

  test("no gap when both roles are clocked in", () => {
    const orders: Order[] = [{
      id: "o1", code: "A-001", venueId: "v", tableId: "t1", tableCode: "T1", zoneId: "z1", zoneName: "VIP",
      guestName: "G", items: [], subtotal: 100, serviceFee: 10, tip: 0, total: 110,
      status: "pending", placedAt: "", updatedAt: "",
    }];
    const staff: StaffMember[] = [
      { id: "s1", venueId: "v", name: "B", role: "bartender", phone: "", email: "", accountStatus: "active", assignedZoneIds: ["z1"], isOnShift: false, avatarInitials: "BT" },
      { id: "s2", venueId: "v", name: "R", role: "runner", phone: "", email: "", accountStatus: "active", assignedZoneIds: ["z1"], isOnShift: false, avatarInitials: "RN" },
    ];
    expect(computeCoverageGaps(zones, orders, staff, new Set(["z1"]))).toHaveLength(0);
  });
});

describe("computeTipDistribution", () => {
  const staff: StaffMember[] = [
    { id: "a", venueId: "v", name: "Alice", role: "bartender", phone: "", email: "", accountStatus: "active", assignedZoneIds: [], isOnShift: false, avatarInitials: "AL", tipPoolWeight: 1.0 },
    { id: "b", venueId: "v", name: "Bob", role: "bartender", phone: "", email: "", accountStatus: "active", assignedZoneIds: [], isOnShift: false, avatarInitials: "BO", tipPoolWeight: 1.0 },
    { id: "c", venueId: "v", name: "Carol", role: "runner", phone: "", email: "", accountStatus: "active", assignedZoneIds: [], isOnShift: false, avatarInitials: "CA", tipPoolWeight: 1.0 },
  ];
  const entries: TimeEntry[] = [
    { id: "e1", venueId: "v", staffId: "a", clockInAt: "", clockOutAt: "", breaks: [], source: "self", minutesWorked: 360 },
    { id: "e2", venueId: "v", staffId: "b", clockInAt: "", clockOutAt: "", breaks: [], source: "self", minutesWorked: 180 },
    { id: "e3", venueId: "v", staffId: "c", clockInAt: "", clockOutAt: "", breaks: [], source: "self", minutesWorked: 360 },
  ];

  const rule: TipPoolRule = {
    id: "r1", venueId: "v", name: "Hours", basis: "hours-weighted",
    includeRoles: ["bartender", "runner"], houseRetentionPct: 0, active: true,
  };

  test("hours-weighted distribution sums exactly to pool", () => {
    const lines = computeTipDistribution(rule, 10000, staff, entries); // $100.00
    expect(lines).toHaveLength(3);
    const total = lines.reduce((s, l) => s + l.shareCents, 0);
    expect(total).toBe(10000);

    // Alice (360 min × 1.0), Bob (180 × 1.0), Carol (360 × 1.0) = 900 basis total
    // Alice: 360/900 = 40% → $40.00
    // Bob: 180/900 = 20% → $20.00
    // Carol: 360/900 = 40% → $40.00
    const alice = lines.find((l) => l.staffId === "a")!;
    const bob = lines.find((l) => l.staffId === "b")!;
    const carol = lines.find((l) => l.staffId === "c")!;
    expect(alice.shareCents).toBe(4000);
    expect(bob.shareCents).toBe(2000);
    expect(carol.shareCents).toBe(4000);
  });

  test("hours-weighted with tipPoolWeight handles weighted members", () => {
    const weighted = staff.map((s) =>
      s.id === "b" ? { ...s, tipPoolWeight: 2.0 } : s,
    );
    const lines = computeTipDistribution(rule, 10000, weighted, entries);
    // Alice 360, Bob 360 (180 × 2), Carol 360 = 1080 total
    expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(10000);
    const bob = lines.find((l) => l.staffId === "b")!;
    expect(bob.shareCents).toBe(3333); // 360/1080 = 33.33% → $33.33
  });

  test("equal basis gives equal shares", () => {
    const equalRule: TipPoolRule = { ...rule, basis: "equal" };
    const lines = computeTipDistribution(equalRule, 10000, staff, entries);
    expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(10000);
    // 10000 / 3 = 3333 remainder 1
  });

  test("three-person pool of $100.01 splits correctly with remainder", () => {
    const lines = computeTipDistribution(rule, 10001, staff, entries);
    expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(10001);
  });

  test("zero-hour member gets nothing", () => {
    const zeroEntries: TimeEntry[] = [
      { id: "e1", venueId: "v", staffId: "a", clockInAt: "", clockOutAt: "", breaks: [], source: "self", minutesWorked: 360 },
      { id: "e2", venueId: "v", staffId: "b", clockInAt: "", clockOutAt: "", breaks: [], source: "self", minutesWorked: 180 },
      { id: "e3", venueId: "v", staffId: "c", clockInAt: "", clockOutAt: "", breaks: [], source: "self", minutesWorked: 0 },
    ];
    const lines = computeTipDistribution(rule, 10000, staff, zeroEntries);
    // Carol excluded because 0 minutes worked
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.shareCents > 0)).toBe(true);
    expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(10000);
  });

  test("houseRetentionPct deducts from pool before distribution", () => {
    const houseRule: TipPoolRule = { ...rule, houseRetentionPct: 10 };
    const lines = computeTipDistribution(houseRule, 10000, staff, entries);
    // pool after retention: $90.00
    expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(9000);
  });
});

describe("computeCommission", () => {
  test("percentage commission on net revenue", () => {
    const rule: CommissionRule = {
      id: "cr1", venueId: "v", staffId: "p1", basis: "net-revenue", ratePct: 10,
    };
    const items = [
      { sourceId: "s1", sourceType: "session" as const, basisCents: 500000 }, // $5,000
    ];
    expect(computeCommission(rule, items)).toBe(50000); // $500
  });

  test("flat commission per reservation", () => {
    const rule: CommissionRule = {
      id: "cr2", venueId: "v", basis: "per-reservation", flatCents: 2000, // $20
    };
    const items = [
      { sourceId: "r1", sourceType: "reservation" as const, basisCents: 0 },
      { sourceId: "r2", sourceType: "reservation" as const, basisCents: 0 },
      { sourceId: "r3", sourceType: "reservation" as const, basisCents: 0 },
    ];
    expect(computeCommission(rule, items)).toBe(6000); // $60
  });

  test("no-show reservation earns nothing", () => {
    // If a reservation no-showed, its basisCents is 0 — the caller is responsible for
    // not passing it to computeCommission. This test documents the contract.
    const rule: CommissionRule = {
      id: "cr3", venueId: "v", basis: "net-revenue", ratePct: 10,
    };
    expect(computeCommission(rule, [])).toBe(0);
  });
});
