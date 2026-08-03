import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, _resetBuckets } from "./rate-limit";

const OPTS = { maxTokens: 3, refillRate: 3, windowMs: 60_000 };

describe("rate limiter", () => {
  beforeEach(() => _resetBuckets());

  it("allows requests up to maxTokens", () => {
    expect(checkRateLimit("test", OPTS).allowed).toBe(true);
    expect(checkRateLimit("test", OPTS).allowed).toBe(true);
    expect(checkRateLimit("test", OPTS).allowed).toBe(true);
  });

  it("rejects the request past the bucket", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("test", OPTS);
    const result = checkRateLimit("test", OPTS);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("separate keys have independent buckets", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("a", OPTS);
    expect(checkRateLimit("a", OPTS).allowed).toBe(false);
    expect(checkRateLimit("b", OPTS).allowed).toBe(true);
  });

  it("returns retryAfterMs = windowMs / refillRate when exhausted", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("test", OPTS);
    const { retryAfterMs } = checkRateLimit("test", OPTS);
    expect(retryAfterMs).toBe(Math.ceil(60_000 / 3));
  });

  // Plan 31: PIN attempt lockout math — 5 attempts per table+IP in 5 minutes.
  it("PIN limit: 5 attempts allowed, 6th rejected with retryAfterMs", () => {
    const PIN_OPTS = { maxTokens: 5, refillRate: 5, windowMs: 300_000 };
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit("pin:table-1:10.0.0.1", PIN_OPTS);
      expect(r.allowed).toBe(true);
    }
    const rejected = checkRateLimit("pin:table-1:10.0.0.1", PIN_OPTS);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterMs).toBe(Math.ceil(300_000 / 5));
  });

  it("PIN limit: different tables have independent buckets", () => {
    const PIN_OPTS = { maxTokens: 5, refillRate: 5, windowMs: 300_000 };
    for (let i = 0; i < 5; i++) checkRateLimit("pin:table-1:10.0.0.1", PIN_OPTS);
    expect(checkRateLimit("pin:table-1:10.0.0.1", PIN_OPTS).allowed).toBe(false);
    // Different table, same IP — still has tokens.
    expect(checkRateLimit("pin:table-2:10.0.0.1", PIN_OPTS).allowed).toBe(true);
  });

  it("PIN limit: same table different IPs are independent", () => {
    const PIN_OPTS = { maxTokens: 5, refillRate: 5, windowMs: 300_000 };
    for (let i = 0; i < 5; i++) checkRateLimit("pin:table-1:10.0.0.1", PIN_OPTS);
    expect(checkRateLimit("pin:table-1:10.0.0.1", PIN_OPTS).allowed).toBe(false);
    expect(checkRateLimit("pin:table-1:10.0.0.2", PIN_OPTS).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  function req(headers: Record<string, string>): NextRequest {
    return new NextRequest(new URL("http://localhost/api/test"), { headers });
  }

  it("prefers x-real-ip (proxy-set) over x-forwarded-for", () => {
    expect(
      getClientIp(req({ "x-real-ip": "10.1.1.1", "x-forwarded-for": "203.0.113.9, 10.1.1.1" })),
    ).toBe("10.1.1.1");
  });

  it("takes the rightmost x-forwarded-for entry — the one the proxy appended", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9, 198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("never trusts the client-supplied leftmost entry over the proxy's", () => {
    // A spoofed inbound header plus the proxy-appended real IP.
    expect(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to unknown when no proxy headers exist", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
