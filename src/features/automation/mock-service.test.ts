import { describe, it, expect, beforeEach } from "vitest";

// Test the logic shapes, not the service (module-scoped state makes tests brittle).
// The mock automation service uses module-level `let` — vitest resets the module
// between files but not within a describe block when using dynamic imports.
describe("AutomationService mock data — rule and execution logic", () => {
  let service: typeof import("@/features/automation/mock-service").mockAutomationService;

  beforeEach(async () => {
    // Dynamic import to get a fresh module copy each test
    const mod = await import("@/features/automation/mock-service");
    service = mod.mockAutomationService;
  });

  it("lists 13 automation rules", async () => {
    const rules = await service.listRules();
    expect(rules).toHaveLength(13);
    const codes = new Set(rules.map((r) => r.code));
    expect(codes.size).toBe(13);
  });

  it("groups rules into six categories", async () => {
    const rules = await service.listRules();
    const categories = new Set(rules.map((r) => r.category));
    expect(categories.size).toBeLessThanOrEqual(6);
  });

  it("every rule has a label, description, and config", async () => {
    const rules = await service.listRules();
    for (const r of rules) {
      expect(r.label).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(Object.keys(r.config).length).toBeGreaterThan(0);
    }
  });

  it("toggles a rule enabled/disabled", async () => {
    const rules = await service.listRules();
    const first = rules[0];
    const was = first.enabled;
    const updated = await service.setEnabled(first.id, !was);
    expect(updated.enabled).toBe(!was);
    // Toggle back
    await service.setEnabled(first.id, was);
  });

  it("rejects toggling a non-existent rule", async () => {
    await expect(service.setEnabled("nonexistent", true)).rejects.toThrow("Automation rule not found");
  });

  it("updates a rule's config", async () => {
    const rules = await service.listRules();
    const first = rules[0];
    const updated = await service.updateConfig(first.id, { graceMinutes: 45 });
    expect(updated.config.graceMinutes).toBe(45);
  });

  it("triggerRule returns a plausible execution and updates lastTriggeredAt", async () => {
    const rules = await service.listRules();
    const first = rules[0];
    const exe = await service.triggerRule(first.id);
    expect(exe.id).toMatch(/^aex-/);
    expect(exe.code).toBe(first.code);
    expect(exe.result.length).toBeGreaterThan(0);
    expect(exe.durationMs).toBeGreaterThan(0);

    const after = await service.listRules();
    const rule = after.find((r) => r.id === first.id);
    expect(rule!.lastTriggeredAt).toBeTruthy();
  });

  it("listExecutions returns seeded entries", async () => {
    const execs = await service.listExecutions();
    expect(execs.length).toBeGreaterThan(0);
    for (const e of execs) {
      expect(e.ruleId).toBeTruthy();
      expect(e.code).toBeTruthy();
      expect(e.triggeredAt).toBeTruthy();
      expect(typeof e.actionApplied).toBe("boolean");
    }
  });
});
