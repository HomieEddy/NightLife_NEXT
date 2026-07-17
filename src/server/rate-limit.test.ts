import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, _resetBuckets } from "./rate-limit";

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
});
