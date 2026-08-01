import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Auth-boundary tests for purchasing route handlers.
 *
 * Every purchasing route gates on requireApiArea("manager"). A staff member
 * (org role "member") calling these routes must get 403; an unauthenticated
 * caller must get 401. These tests import the route handlers directly and
 * mock the auth layer — they don't need a running server.
 *
 * Plan 19 requires: wrong-role 403 for cost:read and stocktake:commit.
 * Since all purchasing routes require manager area, two representative
 * endpoints (GET suppliers and POST stocktake commit) cover the contract.
 */

// ── Mocks (hoisted by Vitest) ───────────────────────────────────────

const mockRequireApiArea = vi.fn();
const mockSessionToDbContext = vi.fn();

vi.mock("@/features/platform/auth-helpers", () => ({
  requireApiArea: (...args: unknown[]) => mockRequireApiArea(...args),
  sessionToDbContext: (...args: unknown[]) => mockSessionToDbContext(...args),
}));

vi.mock("@/features/shared/app-mode", () => ({
  isDemoMode: vi.fn(() => false),
  getAppMode: vi.fn(() => "live"),
}));

// ── Helpers ─────────────────────────────────────────────────────────

function mockRequest(url = "http://localhost/api/purchasing/suppliers"): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("purchasing route auth gates (plan 19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /api/purchasing/suppliers ─────────────────────────────────

  describe("GET /api/purchasing/suppliers", () => {
    it("returns 401 when unauthenticated", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 401, error: "Not authenticated" });

      const { GET } = await import("@/app/api/purchasing/suppliers/route");
      const res = await GET(mockRequest());

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Not authenticated");
    });

    it("returns 403 when caller lacks manager role (staff member)", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 403, error: "Forbidden" });

      const { GET } = await import("@/app/api/purchasing/suppliers/route");
      const res = await GET(mockRequest());

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when account is suspended", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 403, error: "Account suspended" });

      const { GET } = await import("@/app/api/purchasing/suppliers/route");
      const res = await GET(mockRequest());

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Account suspended");
    });

    it("calls requireApiArea with 'manager'", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 401, error: "Not authenticated" });

      const { GET } = await import("@/app/api/purchasing/suppliers/route");
      await GET(mockRequest());

      expect(mockRequireApiArea).toHaveBeenCalledWith("manager");
    });
  });

  // ── POST /api/purchasing/stocktakes/[id]/commit ───────────────────
  // This route now gates on requirePermission("staff", "stocktake:commit") —
  // the area gate is "staff" and the real authority is the stocktake:commit
  // action check inside the guard. The 401/403 area cases still short-circuit
  // before any DB access, so this mock-based suite covers them.

  describe("POST /api/purchasing/stocktakes/:id/commit", () => {
    it("returns 401 when unauthenticated", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 401, error: "Not authenticated" });

      const { POST } = await import("@/app/api/purchasing/stocktakes/[id]/commit/route");
      const res = await POST(mockRequest(), { params: Promise.resolve({ id: "st-1" }) });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Not authenticated");
    });

    it("returns 403 when caller is outside the staff area", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 403, error: "Forbidden" });

      const { POST } = await import("@/app/api/purchasing/stocktakes/[id]/commit/route");
      const res = await POST(mockRequest(), { params: Promise.resolve({ id: "st-1" }) });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
    });

    it("gates on the staff area (action authority is stocktake:commit)", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 401, error: "Not authenticated" });

      const { POST } = await import("@/app/api/purchasing/stocktakes/[id]/commit/route");
      await POST(mockRequest(), { params: Promise.resolve({ id: "st-1" }) });

      expect(mockRequireApiArea).toHaveBeenCalledWith("staff");
    });
  });

  // ── POST /api/purchasing/suppliers ────────────────────────────────

  describe("POST /api/purchasing/suppliers", () => {
    it("returns 403 when caller lacks manager role", async () => {
      mockRequireApiArea.mockResolvedValue({ status: 403, error: "Forbidden" });

      const { POST } = await import("@/app/api/purchasing/suppliers/route");
      const res = await POST(mockRequest());

      expect(res.status).toBe(403);
    });
  });
});
