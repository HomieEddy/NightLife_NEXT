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

for (const route of ["/", "/manager", "/manager/qr"]) {
  test(`${route} fits a 390px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);

    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
}
