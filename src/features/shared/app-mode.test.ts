import { describe, expect, it, vi } from "vitest";
import {
  demoOnlyService,
  liveOnlyService,
  parseAppMode,
  buildDirectoryForMode,
} from "./app-mode";

describe("app mode", () => {
  it.each(["demo", "live"] as const)("accepts explicit %s mode", (mode) => {
    expect(parseAppMode(mode)).toBe(mode);
  });

  it.each([undefined, "", "production", "Demo"])("rejects invalid mode %s", (mode) => {
    expect(() => parseAppMode(mode)).toThrow(/NEXT_PUBLIC_APP_MODE/);
  });

  it.each([
    ["demo", ".next-demo"],
    ["live", ".next-live"],
  ] as const)("isolates the %s compiler output", (mode, directory) => {
    expect(buildDirectoryForMode(mode)).toBe(directory);
  });

  it("rejects a live service before invoking it in demo mode", async () => {
    const implementation = vi.fn();
    const service = liveOnlyService({ run: implementation }, () => "demo");

    await expect(service.run()).rejects.toThrow(/live mode/);
    expect(implementation).not.toHaveBeenCalled();
  });

  it("rejects a demo service before invoking it in live mode", async () => {
    const implementation = vi.fn();
    const service = demoOnlyService({ run: implementation }, () => "live");

    await expect(service.run()).rejects.toThrow(/demo mode/);
    expect(implementation).not.toHaveBeenCalled();
  });
});
