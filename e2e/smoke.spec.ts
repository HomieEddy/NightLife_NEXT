import { test, expect } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/NightLife/i);
});

test("demo guest chooses independent add-on quantities without backend calls", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "demo", "demo-mode smoke");
  const backendRequests: string[] = [];
  await page.route("**/api/**", async (route) => {
    backendRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto("/g/demo-table");
  await page.getByLabel("Your first name").fill("Browser Smoke");
  await page.getByRole("button", { name: "Join this table" }).click();
  await page.getByRole("button", { name: "Simulate host approval" }).click();
  await page.getByRole("button", { name: "Browse the menu" }).click();
  await page.getByRole("button", { name: "All bottles" }).click();
  await page.getByRole("button", { name: /Tito's Handmade/ }).click();
  await page.getByRole("button", { name: /Red Bull 4-pack/ }).click();
  await page.getByRole("button", { name: "Increase Red Bull 4-pack" }).click();
  await page.getByRole("button", { name: "Increase Red Bull 4-pack" }).click();
  await page.getByRole("button", { name: /Enseigne LED/ }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: /Add/ }).click();
  await page.getByRole("button", { name: /View cart/ }).click();

  await expect(page.getByText("3× Red Bull 4-pack")).toBeVisible();
  await expect(page.getByText("1× Enseigne LED + défilé")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your cart" }).getByText("$492", { exact: true }).last()).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("demo links return to the demo home", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "demo", "demo-mode smoke");

  await page.goto("/demo");
  await expect(page.getByRole("link", { name: "Pricing" })).toHaveCount(0);
  // The demo home doesn't link to itself — it offers the login entry instead.
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Back to demo" })).toHaveCount(0);

  // The marketing landing lives on the live app; the demo home is the tour.
  await page.goto("/");
  await expect(page).toHaveURL(/\/demo$/);

  await page.goto("/lead");
  await expect(page.getByRole("link", { name: "Back to demo" })).toHaveAttribute("href", "/demo");
  const pricingResponse = await page.goto("/pricing");
  expect(pricingResponse?.status()).toBe(404);

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Back to demo" })).toHaveAttribute("href", "/demo");
  await expect(page.getByRole("link", { name: "NightLifeNext" })).toHaveAttribute("href", "/demo");

  await page.goto("/g/demo-table");
  await expect(page.getByRole("link", { name: "Back to demo" })).toHaveAttribute("href", "/demo");
});

test("live mode hides demo and ungraduated surfaces", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode smoke");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explore the live demo" })).toHaveAttribute(
    "href",
    process.env.NEXT_PUBLIC_DEMO_URL ?? "http://localhost:3001",
  );
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Back to NightLifeNext" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: /demo/i })).toHaveCount(0);
  await expect(page.getByText("Welcome to the demo")).toHaveCount(0);
  await expect(page.getByText(/Simulate|Demo only/)).toHaveCount(0);

  // The tour is demo-only; /admin, /lead and /manager/subscription are real
  // live surfaces (plan 10) and must NOT 404 here — they gate on a session.
  const demoResponse = await page.goto("/demo");
  expect(demoResponse?.status()).toBe(404);

  for (const route of ["/admin", "/lead", "/manager/subscription"]) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should be served in live mode`).not.toBe(404);
  }
});

test("live mode guards role and guest areas against direct URL entry", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode smoke");

  // Staff/manager areas require a session cookie.
  await page.goto("/manager/orders");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login/);

  // Guest tabs require the table-session cookie set by the QR join flow.
  await page.goto("/guest/menu");
  await expect(page).toHaveURL(/\/$/);
});

test("live pricing distinguishes trial, starter, and pro", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode smoke");

  await page.goto("/pricing");
  await expect(page.getByText("Trial", { exact: true })).toBeVisible();
  await expect(page.getByText("3 days of full access")).toBeVisible();
  await expect(page.getByText("Starter", { exact: true })).toBeVisible();
  await expect(page.getByText("$0.99")).toBeVisible();
  // Labels come from FEATURE_CATALOG — match it exactly, not a paraphrase.
  await expect(page.getByText("Team chat", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Floor map", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pro", { exact: true })).toBeVisible();
  await expect(page.getByText("$1.99")).toBeVisible();
  // Every card lists the whole catalogue, so the tiers are distinguished by
  // their CTA and by which one carries the highlight badge.
  await expect(page.getByRole("link", { name: "Choose Starter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose Pro" })).toBeVisible();
  const proCard = page.locator('[data-slot="card"]').filter({
    has: page.getByRole("link", { name: "Choose Pro" }),
  });
  await expect(proCard.getByText("Best value", { exact: true })).toBeVisible();
});
