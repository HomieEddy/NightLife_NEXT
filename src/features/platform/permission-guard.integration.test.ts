import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import type { AuthSession } from "@/features/platform/auth-helpers";

/**
 * End-to-end auth boundary for the permission guard: the area gate is mocked
 * (that layer is Better Auth's, covered elsewhere) but the ROLE gate runs for
 * real against PGlite — getCurrentStaff → getRolePermissions → canDo. This is
 * the test that proves a wrong role is rejected server-side (plan 15 §5 exit
 * criterion), and that one venue's staff cannot be resolved under another's id.
 */

const mockRequireApiArea = vi.fn();

vi.mock("@/features/shared/app-mode", () => ({
  isDemoMode: vi.fn(() => false),
  getAppMode: vi.fn(() => "live"),
}));

// Replace only requireApiArea; keep sessionToDbContext real so the guard maps
// the mocked session's activeOrganizationId to the venue scope for itself.
vi.mock("@/features/platform/auth-helpers", async (importActual) => {
  const actual = await importActual<typeof import("@/features/platform/auth-helpers")>();
  return { ...actual, requireApiArea: (...args: unknown[]) => mockRequireApiArea(...args) };
});

function sessionFor(userId: string, venueId: string): AuthSession {
  return {
    user: { id: userId, name: userId, email: `${userId}@test.local` },
    session: { id: `sess-${userId}`, activeOrganizationId: venueId },
  };
}

async function makeVenue(raw: PrismaClient, id: string) {
  await raw.organization.create({ data: { id, name: id, slug: id } });
  await raw.venue.create({
    data: {
      id, address: "1 Test St", city: "Testville",
      timezone: "America/Montreal", currency: "CAD",
      openingHours: [], serviceFees: [], floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
}

async function makeStaff(raw: PrismaClient, venueId: string, userId: string, role: string) {
  await raw.user.create({ data: { id: userId, name: userId, email: `${userId}@test.local` } });
  await raw.member.create({ data: { id: `m-${userId}`, userId, organizationId: venueId, role: role === "manager" ? "admin" : "member" } });
  await raw.staffProfile.create({ data: { userId, role: role as never, phone: "555", avatarInitials: "XX" } });
}

describe("requirePermission — role gate (WS-6)", () => {
  let testDb: TestDb;
  let raw: PrismaClient;
  const venueA = "org-guard-a";
  const venueB = "org-guard-b";
  const runnerId = "user-runner";
  const managerId = "user-manager";

  beforeAll(async () => {
    testDb = await createTestDb();
    raw = testDb.rawClient;
    await makeVenue(raw, venueA);
    await makeVenue(raw, venueB);
    await makeStaff(raw, venueA, runnerId, "runner");
    await makeStaff(raw, venueA, managerId, "manager");
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("denies a runner an action their role lacks (tab:void → 403)", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(runnerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");

    const result = await requirePermission("staff", "tab:void");
    expect("error" in result && result.status).toBe(403);
    expect("error" in result && result.error).toContain("runner");
  });

  it("allows a runner an action their role holds (order:claim → context)", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(runnerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");

    const result = await requirePermission("staff", "order:claim");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.staff.role).toBe("runner");
      expect(result.venueId).toBe(venueA);
      expect(result.actor.staffId).toBe(runnerId);
    }
  });

  it("allows a manager the same action the runner was denied (tab:void)", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(managerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");

    const result = await requirePermission("staff", "tab:void");
    expect("error" in result).toBe(false);
  });

  it("honours a venue override — revoking tab:void denies the manager too", async () => {
    const { setRolePermissions, resetRolePermissions } = await import("@/features/platform/permission-core");
    const { getDb } = await import("@/features/shared/db");
    const { DEFAULT_ROLE_PERMISSIONS } = await import("@/features/shared/permissions");

    const stripped = structuredClone(DEFAULT_ROLE_PERMISSIONS);
    stripped.manager = stripped.manager.filter((a) => a !== "tab:void");
    await setRolePermissions(getDb({ venueId: venueA }), stripped);

    mockRequireApiArea.mockResolvedValue({ session: sessionFor(managerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");
    const result = await requirePermission("staff", "tab:void");
    expect("error" in result && result.status).toBe(403);

    await resetRolePermissions(getDb({ venueId: venueA }));
  });

  it("returns 403 when the session's venue has no staff profile for the user (tenant isolation)", async () => {
    // The runner exists only in venue A. A session claiming venue B must not
    // resolve them — getCurrentStaff scopes by organizationId.
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(runnerId, venueB) });
    const { requirePermission } = await import("@/features/platform/permission-guard");

    const result = await requirePermission("staff", "order:claim");
    expect("error" in result && result.status).toBe(403);
    expect("error" in result && result.error).toContain("Staff profile not found");
  });

  it("denies a runner the new money/reversal actions (order:cancel 403)", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(runnerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");
    const result = await requirePermission("staff", "order:cancel");
    expect("error" in result && result.status).toBe(403);
  });

  it("denies a runner the bar-tab close and manual sale actions", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(runnerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");
    for (const action of ["tab:close-bar", "menu:record-sale", "waitlist:manage", "service:refuse"] as const) {
      const result = await requirePermission("staff", action);
      expect("error" in result && result.status).toBe(403);
    }
  });

  it("allows a manager the new money/reversal actions (order:cancel)", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(managerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");
    const result = await requirePermission("staff", "order:cancel");
    expect("error" in result).toBe(false);
  });

  it("allows a manager bar-tab close and manual sale", async () => {
    mockRequireApiArea.mockResolvedValue({ session: sessionFor(managerId, venueA) });
    const { requirePermission } = await import("@/features/platform/permission-guard");
    for (const action of ["tab:close-bar", "menu:record-sale", "waitlist:manage", "service:refuse"] as const) {
      const result = await requirePermission("staff", action);
      expect("error" in result).toBe(false);
    }
  });
});
