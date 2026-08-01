import { describe, expect, test } from "vitest";
import { isNavActive } from "./navigation";

describe("isNavActive", () => {
  test("exact dashboard match", () => {
    expect(isNavActive("/manager", "/manager")).toBe(true);
  });

  test("dashboard is not active on sub-routes", () => {
    expect(isNavActive("/manager/orders", "/manager")).toBe(false);
  });

  test("prefix match on sub-route", () => {
    expect(isNavActive("/manager/orders", "/manager/orders")).toBe(true);
    expect(isNavActive("/manager/orders/42", "/manager/orders")).toBe(true);
  });

  test("prefix collision: /manager/event vs /manager/events", () => {
    expect(isNavActive("/manager/event", "/manager/events")).toBe(false);
    expect(isNavActive("/manager/events", "/manager/events")).toBe(true);
    expect(isNavActive("/manager/events/42", "/manager/events")).toBe(true);
  });

  test("analytics route", () => {
    expect(isNavActive("/manager/analytics", "/manager/analytics")).toBe(true);
    expect(isNavActive("/manager/analytics/reports", "/manager/analytics")).toBe(true);
  });

  test("staff vs staff-schedule", () => {
    expect(isNavActive("/manager/staff", "/manager/staff")).toBe(true);
    expect(isNavActive("/manager/staff-schedule", "/manager/staff")).toBe(false);
  });
});
