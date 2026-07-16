import { describe, expect, it } from "vitest";
import { resolveAppOrigin } from "./app-origins";

describe("app origins", () => {
  it("uses the configured counterpart origin", () => {
    expect(resolveAppOrigin("https://demo.nightlifenext.com", "http://localhost:3001"))
      .toBe("https://demo.nightlifenext.com");
  });

  it("falls back to the local counterpart origin", () => {
    expect(resolveAppOrigin(undefined, "http://localhost:3000"))
      .toBe("http://localhost:3000");
  });

  it("rejects non-http origins", () => {
    expect(() => resolveAppOrigin("javascript:alert(1)", "http://localhost:3000"))
      .toThrow(/http or https/);
  });
});
