import { describe, it, expect, beforeAll } from "vitest";
import { signTableToken, buildTableUrl, verifyTableToken } from "./table-token";

beforeAll(() => {
  process.env.QR_TOKEN_SECRET = "test-qr-secret-at-least-16-chars";
});

describe("table token — sign/verify", () => {
  it("produces a valid signature that verifies", () => {
    const sig = signTableToken("table-1", 0);
    expect(sig.length).toBeGreaterThan(0);

    const result = verifyTableToken(`table-1.${sig}`, (id) =>
      id === "table-1" ? 0 : null,
    );
    expect(result).toEqual({ valid: true, tableId: "table-1" });
  });

  it("rejects a tampered signature", () => {
    const sig = signTableToken("table-1", 0);
    const tampered = sig.slice(0, -2) + "XX";

    const result = verifyTableToken(`table-1.${tampered}`, (id) =>
      id === "table-1" ? 0 : null,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects after tokenVersion bump (revocation)", () => {
    const sig = signTableToken("table-1", 0);

    const result = verifyTableToken(`table-1.${sig}`, (id) =>
      id === "table-1" ? 1 : null,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown tableId", () => {
    const sig = signTableToken("table-1", 0);

    const result = verifyTableToken(`table-1.${sig}`, () => null);
    expect(result).toEqual({ valid: false, tableId: "table-1" });
  });

  it("rejects malformed input without a dot", () => {
    const result = verifyTableToken("no-dot-here", () => 0);
    expect(result).toEqual({ valid: false, tableId: "" });
  });

  it("rejects empty string", () => {
    const result = verifyTableToken("", () => 0);
    expect(result).toEqual({ valid: false, tableId: "" });
  });

  it("different tableIds produce different signatures", () => {
    const sig1 = signTableToken("table-1", 0);
    const sig2 = signTableToken("table-2", 0);
    expect(sig1).not.toBe(sig2);
  });

  it("different versions produce different signatures", () => {
    const sig0 = signTableToken("table-1", 0);
    const sig1 = signTableToken("table-1", 1);
    expect(sig0).not.toBe(sig1);
  });
});

describe("buildTableUrl", () => {
  it("returns tableId.signature format", () => {
    const url = buildTableUrl("table-1", 0);
    expect(url).toMatch(/^table-1\..+$/);

    const result = verifyTableToken(url, (id) =>
      id === "table-1" ? 0 : null,
    );
    expect(result.valid).toBe(true);
  });
});
