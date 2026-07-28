import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import {
  enqueue,
  markSent,
  markFailed,
  getPending,
  getFailed,
  retry,
  discard,
  clearExpired,
} from "./offline-queue";
import type { OfflineCommand } from "./offline-queue";

const storage = new Map<string, string>();

beforeAll(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v); },
    removeItem: (k: string) => { storage.delete(k); },
    clear: () => { storage.clear(); },
    key: () => null,
    length: 0,
  });
});

const storageKey = "nln-offline-queue";

function mkCmd(overrides: Partial<OfflineCommand> = {}): OfflineCommand {
  return {
    commandId: "cmd-001",
    command: "placeOrder",
    payload: { tableId: "t1", itemId: "i1" },
    queuedAt: Date.now(),
    userId: "user-1",
    venueId: "venue-1",
    ...overrides,
  };
}

describe("offline-queue", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("enqueues a command and reads it back", () => {
    const cmd = mkCmd();
    enqueue(cmd);
    const pending = getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].command.commandId).toBe("cmd-001");
    expect(pending[0].status).toBe("queued");
  });

  it("deduplicates by commandId", () => {
    enqueue(mkCmd());
    enqueue(mkCmd()); // same commandId
    expect(getPending()).toHaveLength(1);
  });

  it("marks a command as sent (removes from queue)", () => {
    enqueue(mkCmd());
    markSent("cmd-001");
    expect(getPending()).toHaveLength(0);
  });

  it("marks a command as failed with error", () => {
    enqueue(mkCmd());
    markFailed("cmd-001", "Server error");
    const failed = getFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe("failed");
    expect(failed[0].error).toBe("Server error");
  });

  it("retries a failed command back to queued", () => {
    enqueue(mkCmd());
    markFailed("cmd-001", "Server error");
    retry("cmd-001");
    const pending = getPending();
    expect(pending[0].status).toBe("queued");
  });

  it("discards a command", () => {
    enqueue(mkCmd());
    discard("cmd-001");
    expect(getPending()).toHaveLength(0);
  });

  it("expires commands older than 24 hours", () => {
    const oldCmd = mkCmd({ commandId: "old", queuedAt: Date.now() - 25 * 60 * 60 * 1000 });
    const recentCmd = mkCmd({ commandId: "recent" });
    enqueue(oldCmd);
    enqueue(recentCmd);
    clearExpired();
    const pending = getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].command.commandId).toBe("recent");
  });

  it("getPending returns only non-expired entries", () => {
    const expiredCmd = mkCmd({ commandId: "expired", queuedAt: 0 });
    enqueue(expiredCmd);
    const pending = getPending();
    expect(pending).toHaveLength(0);
  });
});
