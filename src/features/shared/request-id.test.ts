import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  generateRequestId,
  getRequestId,
  withAccessLog,
} from "./request-id";

function makeRequest(path = "/api/test", headers?: Record<string, string>) {
  return new NextRequest(new URL(`http://localhost${path}`), { headers });
}

describe("request-id", () => {
  describe("generateRequestId", () => {
    it("returns a UUID v4 string", () => {
      const id = generateRequestId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(generateRequestId()).not.toBe(id);
    });
  });

  describe("getRequestId", () => {
    it("returns undefined outside a withAccessLog wrapper", () => {
      expect(getRequestId()).toBeUndefined();
    });

    it("returns the requestId inside a wrapped handler", async () => {
      let captured: string | undefined;
      const handler = withAccessLog(async () => {
        captured = getRequestId();
        return NextResponse.json({ ok: true });
      });
      await handler(makeRequest());
      expect(captured).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe("withAccessLog", () => {
    it("generates and sets x-request-id on the response", async () => {
      const handler = withAccessLog(async () =>
        NextResponse.json({ ok: true }),
      );
      const response = await handler(makeRequest());
      const id = response.headers.get("x-request-id");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("propagates an existing x-request-id from the incoming request", async () => {
      const incoming = "11111111-1111-4111-8111-111111111111";
      const handler = withAccessLog(async () =>
        NextResponse.json({ ok: true }),
      );
      const response = await handler(
        makeRequest("/api/test", { "x-request-id": incoming }),
      );
      expect(response.headers.get("x-request-id")).toBe(incoming);
    });

    it("sets x-request-id on error responses", async () => {
      const handler = withAccessLog(async () =>
        NextResponse.json({ error: "fail" }, { status: 500 }),
      );
      const response = await handler(makeRequest());
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });

    it("passes path parameters through to inner handler", async () => {
      const handler = withAccessLog(
        async (_req, ctx) =>
          NextResponse.json({ id: (ctx as { params: { id: string } }).params.id }),
      );
      const response = await handler(makeRequest(), {
        params: { id: "42" },
      });
      const json = await response.json();
      expect(json).toEqual({ id: "42" });
    });

    it("preserves response body and status", async () => {
      const handler = withAccessLog(async () =>
        NextResponse.json({ hello: "world" }, { status: 201 }),
      );
      const response = await handler(makeRequest());
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toEqual({ hello: "world" });
    });
  });
});
