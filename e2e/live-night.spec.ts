import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  const signInResponse = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: "demo1234" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(signInResponse.ok(), await signInResponse.text()).toBe(true);
  const organizationsResponse = await page.request.get("/api/auth/organization/list");
  const organizations = await organizationsResponse.json() as { id: string }[];
  expect(organizations.length).toBeGreaterThan(0);
  const activeResponse = await page.request.post("/api/auth/organization/set-active", {
    data: { organizationId: organizations[0].id },
    headers: { origin: "http://localhost:3000" },
  });
  expect(activeResponse.ok(), await activeResponse.text()).toBe(true);
}

test("live staff approves a signed-QR guest from a second context", async ({ browser }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode flow");
  test.setTimeout(90_000);

  const managerContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const manager = await managerContext.newPage();
  const staff = await staffContext.newPage();
  const guest = await guestContext.newPage();
  for (const page of [manager, staff, guest]) page.setDefaultTimeout(10_000);
  const guestName = `Browser Night ${process.pid}`;

  try {
    await signIn(manager, "amara@velvetmtl.club");
    const tablesResponse = await manager.request.get("/api/tables");
    const tablesBody = await tablesResponse.text();
    expect(tablesResponse.status(), tablesBody || "empty response").toBe(200);
    const tables = JSON.parse(tablesBody) as { id: string; qrSlug: string; status: string }[];
    const table = tables.find((candidate) => candidate.status === "open");
    expect(table).toBeDefined();

    await guest.goto(`/g/${table!.qrSlug}`);
    await guest.getByLabel("Your first name").fill(guestName);
    await guest.getByRole("button", { name: "Join this table" }).click();
    await expect(guest.getByText(`Hang tight, ${guestName}`)).toBeVisible();

    await signIn(staff, "nina@velvetmtl.club");
    await staff.goto("/staff/approvals");
    const request = staff.getByText(guestName, { exact: false }).first();
    await expect(request).toBeVisible();
    const card = request.locator("xpath=ancestor::*[@data-slot='card']");
    await card.getByRole("button", { name: "Approve", exact: true }).click();
    await staff.getByRole("button", { name: "Approve table" }).click();

    await guest.getByRole("button", { name: "Browse the menu" }).click();
    await guest.getByRole("button", { name: "All bottles" }).click();
    await guest.getByRole("button", { name: /Tito's Handmade/ }).click();
    await guest.getByRole("button", { name: /Red Bull 4-pack/ }).click();
    await guest.getByRole("button", { name: /Enseigne LED/ }).click();
    await guest.getByRole("button", { name: /Add/ }).click();
    await guest.getByRole("button", { name: /View cart/ }).click();
    await guest.getByRole("button", { name: /Place order/ }).click();
    await guest.getByRole("button", { name: /Place order/ }).click();
    await expect(guest).toHaveURL(/\/guest\/orders/);

    await staff.goto("/staff/orders");
    const orderCard = staff.getByText(guestName, { exact: false }).first()
      .locator("xpath=ancestor::*[@data-slot='card']");
    await expect(orderCard).toBeVisible();
    await orderCard.getByRole("button", { name: "Claim" }).click();
    for (const label of ["Accept order", "Start preparing", "Mark ready", "Mark delivered"]) {
      await orderCard.getByRole("button", { name: label, exact: true }).click();
      await staff.getByRole("button", { name: label, exact: true }).last().click();
    }

    await expect(guest.getByText("Delivered", { exact: true })).toBeVisible({ timeout: 10_000 });
    await guest.getByRole("button", { name: "Request to close my tab" }).click();
    await expect(guest.getByText("Waiting for your host…")).toBeVisible();

    await staff.goto("/staff/approvals");
    const closureCard = staff.getByText(guestName, { exact: false }).first()
      .locator("xpath=ancestor::*[@data-slot='card']");
    await closureCard.getByRole("button", { name: "Record settlement & close" }).click();
    await staff.getByLabel("Settlement method").click();
    await staff.getByRole("option", { name: "Card terminal" }).click();
    await staff.getByRole("button", { name: "Record & close tab" }).click();

    await expect(guest).toHaveURL(/\/guest\/receipt/, { timeout: 10_000 });
    const finalTablesResponse = await manager.request.get("/api/tables");
    const finalTables = await finalTablesResponse.json() as { id: string; status: string }[];
    expect(finalTables.find((candidate) => candidate.id === table!.id)?.status).toBe("open");
  } finally {
    await Promise.all([managerContext.close(), staffContext.close(), guestContext.close()]);
  }
});
