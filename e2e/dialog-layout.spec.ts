import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nln-auth-user", JSON.stringify({
      id: "user-manager",
      name: "Amara Diallo",
      email: "amara@velvetmtl.club",
      role: "manager",
      venueId: "venue-1",
    }));
    localStorage.setItem("nlx-manager-onboarded", "1");
  });
});

test("Edit Category fits its dialog", async ({ page }) => {
  // Seeds demo-only localStorage auth, so it can only run against the demo build.
  test.skip(process.env.NEXT_PUBLIC_APP_MODE === "live", "demo-mode layout check");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/manager/menu");
  await page.getByRole("button", { name: "Edit category" }).click();

  const size = await page.getByRole("dialog").evaluate((dialog) => ({
    clientWidth: dialog.clientWidth,
    scrollWidth: dialog.scrollWidth,
  }));

  expect(size.clientWidth).toBeGreaterThanOrEqual(700);
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
});
