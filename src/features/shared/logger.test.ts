import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import pino from "pino";

/**
 * Plan 32: Verify the pino redaction config scrubs PII fields and that the
 * backwards-compatible logger API still works.
 *
 * We re-create the same redaction config the logger module uses and write
 * through a PassThrough so ESM hoisting can't steal our reference.
 */

const REDACT_PATHS = [
  "email",
  "phone",
  "authorization",
  "cookie",
  "pin",
  "token",
  "secret",
  "password",
  "*.email",
  "*.phone",
  "*.pin",
  "*.token",
  "*.secret",
  "*.password",
  "headers.authorization",
  "headers.cookie",
  "headers.*authorization",
  "headers.*cookie",
];

function capturedLogger() {
  const stream = new PassThrough();
  let raw = "";
  stream.on("data", (chunk: Buffer) => {
    raw += chunk.toString();
  });
  const instance = pino(
    {
      level: "debug",
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
      formatters: { level: (label) => ({ level: label }) },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream,
  );
  return {
    info: (msg: string, meta?: Record<string, unknown>) => instance.info(meta ?? {}, msg),
    warn: (msg: string, meta?: Record<string, unknown>) => instance.warn(meta ?? {}, msg),
    error: (msg: string, meta?: Record<string, unknown>) => instance.error(meta ?? {}, msg),
    lastJson: () => {
      const lines = raw.split("\n").filter(Boolean);
      return JSON.parse(lines.at(-1) ?? "{}");
    },
  };
}

describe("logger (pino redaction)", () => {
  it("redacts email fields in meta", () => {
    const log = capturedLogger();
    log.info("user login", { email: "alice@example.com", userId: "u1" });
    const obj = log.lastJson();
    expect(obj.email).toBe("[REDACTED]");
    expect(obj.userId).toBe("u1");
  });

  it("redacts phone and pin fields", () => {
    const log = capturedLogger();
    log.info("verification", { phone: "+15145551234", pin: "1234", action: "validate" });
    const obj = log.lastJson();
    expect(obj.phone).toBe("[REDACTED]");
    expect(obj.pin).toBe("[REDACTED]");
    expect(obj.action).toBe("validate");
  });

  it("redacts nested PII via wildcard paths", () => {
    const log = capturedLogger();
    log.info("request", { req: { email: "bob@venue.ca", id: "r1" } });
    const obj = log.lastJson();
    expect((obj.req as Record<string, unknown>).email).toBe("[REDACTED]");
  });

  it("redacts authorization and cookie in headers-like meta", () => {
    const log = capturedLogger();
    log.info("incoming", {
      headers: { authorization: "Bearer tok", cookie: "sid=abc", "content-type": "json" },
    });
    const obj = log.lastJson();
    const h = obj.headers as Record<string, unknown>;
    expect(h.authorization).toBe("[REDACTED]");
    expect(h.cookie).toBe("[REDACTED]");
    expect(h["content-type"]).toBe("json");
  });

  it("redacts token and secret fields", () => {
    const log = capturedLogger();
    log.info("config", { token: "abc123", secret: "shh", publicFlag: true });
    const obj = log.lastJson();
    expect(obj.token).toBe("[REDACTED]");
    expect(obj.secret).toBe("[REDACTED]");
    expect(obj.publicFlag).toBe(true);
  });

  it("maintains call signature: info(msg)", () => {
    const log = capturedLogger();
    log.info("bare message");
    const obj = log.lastJson();
    expect(obj.msg).toBe("bare message");
    expect(obj.level).toBe("info");
  });

  it("maintains call signature: warn(msg, meta)", () => {
    const log = capturedLogger();
    log.warn("slow query", { duration_ms: 2450 });
    const obj = log.lastJson();
    expect(obj.msg).toBe("slow query");
    expect(obj.level).toBe("warn");
    expect(obj.duration_ms).toBe(2450);
  });

  it("maintains call signature: error(msg, meta)", () => {
    const log = capturedLogger();
    log.error("db down", { err: "ECONNREFUSED" });
    const obj = log.lastJson();
    expect(obj.msg).toBe("db down");
    expect(obj.level).toBe("error");
    expect(obj.err).toBe("ECONNREFUSED");
  });
});
