import { expect, test, type Page } from "@playwright/test";

// Better Auth rejects a mismatched origin, so this must track E2E_PORT rather
// than assume 3000.
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? "3000"}`;

async function signIn(page: Page, email: string) {
  const signInResponse = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: "demo1234" },
    headers: { origin: ORIGIN },
  });
  expect(signInResponse.ok(), await signInResponse.text()).toBe(true);
  const organizationsResponse = await page.request.get("/api/auth/organization/list");
  const organizations = await organizationsResponse.json() as { id: string }[];
  expect(organizations.length).toBeGreaterThan(0);
  const activeResponse = await page.request.post("/api/auth/organization/set-active", {
    data: { organizationId: organizations[0].id },
    headers: { origin: ORIGIN },
  });
  expect(activeResponse.ok(), await activeResponse.text()).toBe(true);
}

/**
 * The suite runs fullyParallel, so each spec must claim a *different* table —
 * two guests seated at the same one approve and order over each other.
 */
async function openTable(manager: Page, index = 0) {
  const tablesResponse = await manager.request.get("/api/tables");
  const tablesBody = await tablesResponse.text();
  expect(tablesResponse.status(), tablesBody || "empty response").toBe(200);
  const tables = JSON.parse(tablesBody) as { id: string; qrSlug: string; status: string }[];
  const open = tables.filter((candidate) => candidate.status === "open");
  expect(open.length, "no open tables seeded").toBeGreaterThan(index);
  return open[index];
}

/** QR scan → join → host approval, the precondition for anything guest-side. */
async function joinAndApprove(guest: Page, staff: Page, qrSlug: string, guestName: string) {
  await guest.goto(`/g/${qrSlug}`);
  await guest.getByLabel("Your first name").fill(guestName);
  await guest.getByRole("button", { name: "Join this table" }).click();
  await expect(guest.getByText(`Hang tight, ${guestName}`)).toBeVisible();

  await staff.goto("/staff/approvals");
  const request = staff.getByText(guestName, { exact: false }).first();
  await expect(request).toBeVisible();
  const card = request.locator("xpath=ancestor::*[@data-slot='card']");
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await staff.getByRole("button", { name: "Approve table" }).click();
}

test("live staff approves a signed-QR guest from a second context", async ({ browser }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode flow");
  test.setTimeout(90_000);

  const managerContext = await browser.newContext();
  const hostContext = await browser.newContext();
  const barContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const manager = await managerContext.newPage();
  const host = await hostContext.newPage();
  const bartender = await barContext.newPage();
  const guest = await guestContext.newPage();
  for (const page of [manager, host, bartender, guest]) page.setDefaultTimeout(10_000);
  const guestName = `Browser Night ${process.pid}`;

  try {
    await signIn(manager, "amara@velvetmtl.club");
    const table = await openTable(manager);

    // Roles are enforced server-side (WS-6): approvals and tab closure are the
    // host's, order acceptance the bar's. A runner has order:transition but not
    // order:accept, so one staff login cannot drive this whole flow.
    await signIn(host, "lucas@velvetmtl.club");
    await signIn(bartender, "sofia@velvetmtl.club");
    await joinAndApprove(guest, host, table.qrSlug, guestName);

    await guest.getByRole("button", { name: "Browse the menu" }).click();
    await guest.getByRole("button", { name: "All bottles" }).click();
    await guest.getByRole("button", { name: /Tito's Handmade/ }).click();
    // "Washers" is a required modifier group — Add stays disabled until one is picked.
    await guest.getByRole("button", { name: /Red Bull 6-pack/ }).click();
    await guest.getByRole("button", { name: /LED sign \+ parade/ }).click();
    await guest.getByRole("button", { name: /Add/ }).click();
    await guest.getByRole("button", { name: /View cart/ }).click();
    await guest.getByRole("button", { name: /Place order/ }).click();
    await guest.getByRole("button", { name: /Place order/ }).click();
    await expect(guest).toHaveURL(/\/guest\/orders/);

    await bartender.goto("/staff/orders");
    const orderCard = bartender.getByText(guestName, { exact: false }).first()
      .locator("xpath=ancestor::*[@data-slot='card']");
    await expect(orderCard).toBeVisible();
    await orderCard.getByRole("button", { name: "Claim" }).click();
    for (const label of ["Accept order", "Start preparing", "Mark ready", "Mark delivered"]) {
      await orderCard.getByRole("button", { name: label, exact: true }).click();
      await bartender.getByRole("button", { name: label, exact: true }).last().click();
    }

    await expect(guest.getByText("Delivered", { exact: true })).toBeVisible({ timeout: 10_000 });
    await guest.getByRole("button", { name: "Request to close my tab" }).click();
    await expect(guest.getByText("Waiting for your host…")).toBeVisible();

    await host.goto("/staff/approvals");
    const closureCard = host.getByText(guestName, { exact: false }).first()
      .locator("xpath=ancestor::*[@data-slot='card']");
    await closureCard.getByRole("button", { name: "Record settlement & close" }).click();
    await host.getByLabel("Settlement method").click();
    await host.getByRole("option", { name: "Card terminal" }).click();
    await host.getByRole("button", { name: "Record & close tab" }).click();

    await expect(guest).toHaveURL(/\/guest\/receipt/, { timeout: 10_000 });
    const finalTablesResponse = await manager.request.get("/api/tables");
    const finalTables = await finalTablesResponse.json() as { id: string; status: string }[];
    expect(finalTables.find((candidate) => candidate.id === table!.id)?.status).toBe("open");
  } finally {
    await Promise.all([
      managerContext.close(),
      hostContext.close(),
      barContext.close(),
      guestContext.close(),
    ]);
  }
});

test("a manager's fee change reaches the guest cart", async ({ browser }) => {
  test.skip(process.env.NEXT_PUBLIC_APP_MODE !== "live", "live-mode flow");
  test.setTimeout(90_000);

  const managerContext = await browser.newContext();
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const manager = await managerContext.newPage();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  for (const page of [manager, host, guest]) page.setDefaultTimeout(10_000);

  const guestName = `Fee Watcher ${process.pid}`;
  // Unique so the assertion can't pass on a pre-existing seeded fee.
  const feeName = `Audit Levy ${process.pid}`;
  let originalFees: unknown;

  try {
    await signIn(manager, "amara@velvetmtl.club");

    const venue = await (await manager.request.get("/api/venue")).json() as {
      serviceFees: { id: string; name: string; type: string; value: number }[];
    };
    originalFees = venue.serviceFees;

    const patched = await manager.request.patch("/api/venue", {
      data: {
        serviceFees: [
          ...venue.serviceFees,
          { id: `fee-audit-${process.pid}`, name: feeName, type: "percentage", value: 3 },
        ],
      },
      headers: { origin: ORIGIN },
    });
    expect(patched.ok(), await patched.text()).toBe(true);

    const table = await openTable(manager, 1);
    await signIn(host, "lucas@velvetmtl.club");
    await joinAndApprove(guest, host, table.qrSlug, guestName);

    await guest.getByRole("button", { name: "Browse the menu" }).click();
    await guest.getByRole("button", { name: "All bottles" }).click();
    await guest.getByRole("button", { name: /Tito's Handmade/ }).click();
    // "Washers" is a required modifier group — Add stays disabled until one is picked.
    await guest.getByRole("button", { name: /Tonic Water/ }).click();
    await guest.getByRole("button", { name: /Add/ }).click();
    await guest.getByRole("button", { name: /View cart/ }).click();

    // The fee the manager just created must be priced into this cart.
    await expect(guest.getByText(feeName, { exact: false })).toBeVisible({ timeout: 10_000 });
  } finally {
    if (originalFees) {
      await manager.request.patch("/api/venue", {
        data: { serviceFees: originalFees },
        headers: { origin: ORIGIN },
      }).catch(() => {});
    }
    await Promise.all([managerContext.close(), hostContext.close(), guestContext.close()]);
  }
});
