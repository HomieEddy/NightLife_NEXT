import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { HttpError, apiError, apiErrorFromCatch, apiZodError, apiRateLimitError } from "./api-error";

// Mock logger so a 5xx path doesn't actually write; assert the sanitised body.
vi.mock("@/features/shared/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("apiError", () => {
  it("returns a 4xx body verbatim (UX message is not sanitised)", () => {
    const res = apiError(404, "Reservation not found");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("sanitises a 5xx to a generic body, never leaking the message", async () => {
    const res = apiError(500, "secret stack trace detail", { detail: "DB outage" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("secret stack");
  });

  it("passes custom headers through (e.g. Retry-After)", () => {
    const res = apiError(503, "down", { headers: { "Retry-After": "30" } });
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("logs detail only for 5xx", async () => {
    const logger = (await import("@/features/shared/logger")).logger as unknown as { error: ReturnType<typeof vi.fn> };
    logger.error.mockClear();
    apiError(500, "boom", { detail: { id: 1 } });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("HttpError", () => {
  it("carries a status and message for route handlers to catch", () => {
    const e = new HttpError(409, "already committed");
    expect(e.status).toBe(409);
    expect(e.message).toBe("already committed");
    expect(e.name).toBe("HttpError");
  });
});

describe("apiErrorFromCatch", () => {
  it("passes an HttpError through with its status and message", async () => {
    const res = apiErrorFromCatch(new HttpError(422, "invalid input"), "fallback");
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid input");
  });

  it("sanitises a non-HttpError into a generic 500 (message never leaked)", async () => {
    const res = apiErrorFromCatch(new Error("internal leak"), "operation failed");
    expect(res.status).toBe(500);
    // The 5xx branch sanitises the body to a generic message regardless of
    // the logMessage — the caller's message is never returned to the client.
    expect((await res.json()).error).toBe("Internal server error");
  });
});

describe("apiZodError", () => {
  it("returns the Zod message as a 400", async () => {
    const fakeError = { message: "Invalid email: expected string" } as never;
    const res = apiZodError(fakeError);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid email: expected string");
  });
});

describe("apiRateLimitError", () => {
  it("returns 429 with a Retry-After header", async () => {
    const res = apiRateLimitError(42_000);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect((await res.json()).error).toBe("Too many requests");
  });

  it("ceil-rounds fractional seconds up", () => {
    const res = apiRateLimitError(1_500);
    expect(res.headers.get("Retry-After")).toBe("2");
  });
});
