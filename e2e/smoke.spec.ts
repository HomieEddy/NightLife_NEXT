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

test("demo links back to the live landing page", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "demo", "demo-mode smoke");

  await page.goto("/demo");
  const backLink = page.getByRole("link", { name: "Back to NightLifeNext" });
  await expect(backLink).toHaveAttribute(
    "href",
    process.env.NEXT_PUBLIC_LIVE_URL ?? "http://localhost:3000",
  );

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Back to NightLifeNext" })).toHaveAttribute(
    "href",
    process.env.NEXT_PUBLIC_LIVE_URL ?? "http://localhost:3000",
  );
});

test("live mode hides demo and ungraduated surfaces", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode smoke");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explore the live demo" })).toHaveAttribute(
    "href",
    process.env.NEXT_PUBLIC_DEMO_URL ?? "http://localhost:3001",
  );

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Back to NightLifeNext" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: /demo/i })).toHaveCount(0);
  await expect(page.getByText("Welcome to the demo")).toHaveCount(0);
  await expect(page.getByText(/Simulate|Demo only/)).toHaveCount(0);

  const demoResponse = await page.goto("/demo");
  expect(demoResponse?.status()).toBe(404);
  const adminResponse = await page.goto("/admin");
  expect(adminResponse?.status()).toBe(404);
  const leadResponse = await page.goto("/lead");
  expect(leadResponse?.status()).toBe(404);
  const billingResponse = await page.goto("/manager/subscription");
  expect(billingResponse?.status()).toBe(404);
});
