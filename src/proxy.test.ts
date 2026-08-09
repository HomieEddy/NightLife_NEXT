import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

type AccessCall = { level: "info" | "warn" | "error"; msg: string; meta: Record<string, unknown> };

const logCalls = vi.hoisted(() => [] as AccessCall[]);

vi.mock("@/features/shared/logger", () => ({
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) =>
      logCalls.push({ level: "info", msg, meta: meta ?? {} }),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      logCalls.push({ level: "warn", msg, meta: meta ?? {} }),
    error: (msg: string, meta?: Record<string, unknown>) =>
      logCalls.push({ level: "error", msg, meta: meta ?? {} }),
  },
}));

import { proxy } from "@/proxy";

function req(path: string, headers: Record<string, string> = {}, lang?: string): NextRequest {
  const url = lang ? `http://localhost${path}?lang=${lang}` : `http://localhost${path}`;
  return new NextRequest(url, { headers });
}

const SESSION_COOKIE = "better-auth.session_token=abc123";

describe("proxy — live mode routing", () => {
  beforeEach(() => {
    logCalls.length = 0;
  });

  it("passes through public embed surfaces with a request id", () => {
    const res = proxy(req("/r/velvet-montreal"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(proxy(req("/e/velvet-montreal")).status).toBe(200);
  });

  it("applies ?lang= as a persisted cookie on embeds", () => {
    const res = proxy(req("/r/velvet-montreal", {}, "fr"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("nln-locale=fr");
    // The request cookie is also set so THIS render is French.
    const r = req("/r/x", {}, "fr");
    proxy(r);
    expect(r.cookies.get("nln-locale")?.value).toBe("fr");
  });

  it("ignores invalid ?lang= values", () => {
    const res = proxy(req("/r/velvet-montreal", {}, "de"));
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes through /lead publicly", () => {
    const res = proxy(req("/lead"));
    expect(res.status).toBe(200);
  });

  it("404s /demo in the live build", () => {
    const res = proxy(req("/demo"));
    expect(res.status).toBe(404);
  });

  it("passes through /api routes to their own auth", () => {
    const res = proxy(req("/api/health"));
    expect(res.status).toBe(200);
  });

  it("redirects /admin without a session to /login", () => {
    const res = proxy(req("/admin"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("allows /admin with a session cookie", () => {
    const res = proxy(req("/admin", { cookie: SESSION_COOKIE }));
    expect(res.status).toBe(200);
  });

  it("redirects /manager and /staff without a session", () => {
    for (const path of ["/manager", "/staff", "/manager/orders", "/staff/help"]) {
      const res = proxy(req(path));
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, path).toBe("/login");
    }
  });

  it("allows manager/staff routes with a session", () => {
    for (const path of ["/manager", "/staff"]) {
      const res = proxy(req(path, { cookie: SESSION_COOKIE }));
      expect(res.status, path).toBe(200);
    }
  });

  it("redirects /guest without the guest cookie to the landing page", () => {
    const res = proxy(req("/guest/menu"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("allows /guest with the table-session cookie", () => {
    const res = proxy(req("/guest/menu", { cookie: "nln-guest-session=sess1" }));
    expect(res.status).toBe(200);
  });
});

describe("proxy — request-id and access logging", () => {
  beforeEach(() => {
    logCalls.length = 0;
  });

  it("stamps the same request id on the response and the access log", () => {
    const res = proxy(req("/lead"));
    const id = res.headers.get("x-request-id");
    expect(id).toBeTruthy();
    expect(logCalls).toHaveLength(1);
    expect(logCalls[0].meta.requestId).toBe(id);
    expect(logCalls[0].meta.path).toBe("/lead");
    expect(logCalls[0].meta.status).toBe(200);
    expect(typeof logCalls[0].meta.duration_ms).toBe("number");
  });

  it("propagates an incoming x-request-id instead of generating one", () => {
    const incoming = "11111111-1111-4111-8111-111111111111";
    const res = proxy(req("/lead", { "x-request-id": incoming }));
    expect(res.headers.get("x-request-id")).toBe(incoming);
    expect(logCalls[0].meta.requestId).toBe(incoming);
  });

  it("logs redirects as info and 404s as warn", () => {
    proxy(req("/manager"));
    proxy(req("/demo"));
    // 307 is a 3xx — not an error — so it logs at info.
    expect(logCalls[0].level).toBe("info");
    expect(logCalls[0].meta.status).toBe(307);
    expect(logCalls[1].level).toBe("warn");
    expect(logCalls[1].meta.status).toBe(404);
  });

  it("logs successful passes as info", () => {
    proxy(req("/lead"));
    expect(logCalls[0].level).toBe("info");
    expect(logCalls[0].meta.status).toBe(200);
  });

  it("sets the response header even when the handler throws nothing (redirect path)", () => {
    const res = proxy(req("/guest/menu"));
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});

describe("proxy — demo mode", () => {
  it("returns early without auth checks or access logging", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "demo");
    logCalls.length = 0;
    try {
      const { proxy: demoProxy } = await import("@/proxy");
      // No session, no guest cookie — demo still passes everything through.
      expect(demoProxy(req("/manager")).status).toBe(200);
      expect(demoProxy(req("/guest/menu")).status).toBe(200);
      expect(demoProxy(req("/demo")).status).toBe(200);
      // ...but ?lang= still persists on embeds.
      const res = demoProxy(req("/r/velvet-montreal", {}, "fr"));
      expect(res.headers.get("set-cookie") ?? "").toContain("nln-locale=fr");
      // No access logging in the sandbox.
      expect(logCalls).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
