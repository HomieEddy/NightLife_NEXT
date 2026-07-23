/**
 * Captures device-framed promo screenshots from the LIVE app (real auth,
 * real seeded data — not the mock demo track). Run against a live server,
 * e.g.:
 *
 *   npm run dev:pglite:seed        # terminal 1 — in-process Postgres + seed
 *   npx tsx scripts/promo-screenshots.ts   # terminal 2
 *
 * Output: promo-output/<role>-<name>.png, each composited into a simple
 * programmatic iPhone or laptop frame (no external mockup assets needed).
 */

import { chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.PROMO_BASE_URL ?? "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "promo-output");

const IPHONE_VIEWPORT = { width: 390, height: 844 };
const LAPTOP_VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2; // deviceScaleFactor — crisp output for retina/print use

const CREDS = {
  manager: { email: "amara@velvetmtl.club", password: "demo1234" },
  staff: { email: "nina@velvetmtl.club", password: "demo1234" },
  admin: { email: "admin@nightlifext.com", password: "demo1234" },
} as const;

type Role = keyof typeof CREDS;
type Frame = "iphone" | "laptop";

type Shot = {
  role: Role;
  path: string;
  name: string;
  frame: Frame;
  waitForSelector?: string;
};

const SHOTS: Shot[] = [
  { role: "manager", path: "/manager", name: "dashboard", frame: "laptop" },
  { role: "manager", path: "/manager/analytics", name: "analytics", frame: "laptop" },
  { role: "manager", path: "/manager/floor-map", name: "floor-map", frame: "laptop" },
  { role: "manager", path: "/manager/tables", name: "tables", frame: "laptop" },
  { role: "staff", path: "/staff", name: "home", frame: "iphone" },
  { role: "staff", path: "/staff/orders", name: "orders", frame: "iphone" },
  { role: "admin", path: "/admin", name: "overview", frame: "laptop" },
  { role: "admin", path: "/admin/venues", name: "venues", frame: "laptop" },
];

// ── Device frames (programmatic — no external assets) ─────────────────

async function roundCorners(png: Buffer, w: number, h: number, radius: number) {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  return sharp(png).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function frameIphone(screenshot: Buffer): Promise<Buffer> {
  const { width: w = 0, height: h = 0 } = await sharp(screenshot).metadata();
  const bezelX = Math.round(w * 0.045);
  const bezelTop = Math.round(w * 0.08);
  const bezelBottom = Math.round(w * 0.08);
  const outerW = w + bezelX * 2;
  const outerH = h + bezelTop + bezelBottom;
  const outerRadius = Math.round(w * 0.16);
  const innerRadius = Math.round(w * 0.1);

  const roundedScreen = await roundCorners(screenshot, w, h, innerRadius);

  const notchW = Math.round(w * 0.32);
  const notchH = Math.round(bezelTop * 0.45);
  const notchX = Math.round((outerW - notchW) / 2);
  const notchY = Math.round(bezelTop * 0.22);

  const bezelSvg = Buffer.from(`
    <svg width="${outerW}" height="${outerH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${outerW}" height="${outerH}" rx="${outerRadius}" ry="${outerRadius}" fill="#111114"/>
      <rect x="1.5" y="1.5" width="${outerW - 3}" height="${outerH - 3}" rx="${outerRadius}" ry="${outerRadius}"
        fill="none" stroke="#3a3a40" stroke-width="1.5"/>
    </svg>`);

  const notchSvg = Buffer.from(`
    <svg width="${outerW}" height="${outerH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${notchX}" y="${notchY}" width="${notchW}" height="${notchH}" rx="${notchH / 2}" ry="${notchH / 2}" fill="#000"/>
    </svg>`);

  return sharp(bezelSvg)
    .composite([
      { input: roundedScreen, left: bezelX, top: bezelTop },
      { input: notchSvg, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function frameLaptop(screenshot: Buffer): Promise<Buffer> {
  const { width: w = 0, height: h = 0 } = await sharp(screenshot).metadata();
  const chromeH = Math.round(w * 0.045);
  const bezel = Math.round(w * 0.006);
  const outerW = w + bezel * 2;
  const outerH = h + chromeH + bezel * 2;
  const radius = Math.round(w * 0.012);
  const dotR = Math.round(chromeH * 0.14);
  const dotY = bezel + chromeH / 2;
  const barW = Math.round(w * 0.32);
  const barH = Math.round(chromeH * 0.5);
  const barX = Math.round((outerW - barW) / 2);
  const barY = bezel + Math.round((chromeH - barH) / 2);

  const chromeSvg = Buffer.from(`
    <svg width="${outerW}" height="${outerH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${outerW}" height="${outerH}" rx="${radius}" ry="${radius}" fill="#dcdce2"/>
      <rect x="${bezel}" y="${bezel + chromeH}" width="${w}" height="${h}" fill="#000"/>
      <circle cx="${bezel + dotR * 3}" cy="${dotY}" r="${dotR}" fill="#ff5f57"/>
      <circle cx="${bezel + dotR * 6.5}" cy="${dotY}" r="${dotR}" fill="#febc2e"/>
      <circle cx="${bezel + dotR * 10}" cy="${dotY}" r="${dotR}" fill="#28c840"/>
      <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barH / 2}" ry="${barH / 2}" fill="#f2f2f6"/>
      <text x="${outerW / 2}" y="${barY + barH * 0.7}" font-family="sans-serif" font-size="${barH * 0.5}"
        fill="#666" text-anchor="middle">nightlifenext.app</text>
    </svg>`);

  return sharp(chromeSvg)
    .composite([{ input: screenshot, left: bezel, top: bezel + chromeH }])
    .png()
    .toBuffer();
}

async function applyFrame(frame: Frame, screenshot: Buffer) {
  return frame === "iphone" ? frameIphone(screenshot) : frameLaptop(screenshot);
}

// ── Playwright driving ─────────────────────────────────────────────────

async function login(page: Page, role: Role) {
  const { email, password } = CREDS[role];
  await page.goto(`${BASE_URL}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(new RegExp(`/${role}(/|$)`), { timeout: 15_000 });
}

async function capture(page: Page, shot: Shot) {
  await page.goto(`${BASE_URL}${shot.path}`);
  await page.waitForLoadState("load");
  if (shot.waitForSelector) await page.locator(shot.waitForSelector).first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1200); // client-side data fetch + entrance animations settle
  const raw = await page.screenshot();
  const framed = await applyFrame(shot.frame, raw);
  const file = path.join(OUTPUT_DIR, `${shot.role}-${shot.name}.png`);
  await writeFile(file, framed);
  console.log(`  saved ${path.relative(process.cwd(), file)}`);
}

async function captureGuestFlow(browser: import("@playwright/test").Browser) {
  console.log("guest flow:");
  const managerCtx = await browser.newContext({ viewport: LAPTOP_VIEWPORT, deviceScaleFactor: SCALE });
  const managerPage = await managerCtx.newPage();
  await login(managerPage, "manager");
  await managerPage.goto(`${BASE_URL}/manager/qr`);
  await managerPage.waitForLoadState("load");
  await managerPage.waitForTimeout(1200);

  // Pick a table that's actually open — a table left occupied by a previous
  // promo run would make the join reuse/conflict with its existing session.
  const cards = managerPage.locator('[data-slot="card"]');
  const cardCount = await cards.count();
  let guestPath: string | undefined;
  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const isOpen = (await card.locator("span").filter({ hasText: /^open$/i }).count()) > 0;
    if (!isOpen) continue;
    const slugText = await card.locator("text=/^\\/g\\//").first().textContent();
    if (slugText?.trim()) {
      guestPath = slugText.trim();
      break;
    }
  }
  if (!guestPath) {
    console.warn("  no open table found — skipping guest flow (reseed the DB to reset table state)");
    await managerCtx.close();
    return;
  }

  const guestCtx = await browser.newContext({
    viewport: IPHONE_VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
  });
  const guestPage = await guestCtx.newPage();
  await guestPage.goto(`${BASE_URL}${guestPath}`);
  await guestPage.waitForLoadState("load");
  await guestPage.waitForTimeout(1200);
  await writeFile(
    path.join(OUTPUT_DIR, "guest-join.png"),
    await applyFrame("iphone", await guestPage.screenshot()),
  );
  console.log("  saved guest-join.png");

  const guestName = `PromoGuest${Date.now() % 10_000}`;
  await guestPage.locator("#guest-name").fill(guestName);
  await guestPage.getByRole("button", { name: "Join this table" }).click();
  await guestPage.waitForURL(/\/guest\/waiting/, { timeout: 10_000 });
  await writeFile(
    path.join(OUTPUT_DIR, "guest-waiting.png"),
    await applyFrame("iphone", await guestPage.screenshot()),
  );
  console.log("  saved guest-waiting.png");

  // Approve from staff so the guest reaches the menu.
  const staffCtx = await browser.newContext({ viewport: LAPTOP_VIEWPORT, deviceScaleFactor: SCALE });
  const staffPage = await staffCtx.newPage();
  await login(staffPage, "staff");
  await staffPage.goto(`${BASE_URL}/staff/approvals`);
  await staffPage.waitForLoadState("load");
  await staffPage.waitForTimeout(1200);
  try {
    const row = staffPage.locator('[data-slot="card"]').filter({ hasText: guestName });
    await row.getByRole("button", { name: "Approve" }).click({ timeout: 5_000 });
    // wait for the confirm dialog to finish animating in before clicking its confirm button
    const dialog = staffPage.getByRole("dialog");
    await dialog.getByRole("button", { name: "Approve table" }).waitFor({ timeout: 5_000 });
    await dialog.getByRole("button", { name: "Approve table" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 5_000 });
    console.log("  staff approved the session");
  } catch (e) {
    console.warn("  no pending approval found on staff side — guest menu may not be reachable", e);
  }
  await staffCtx.close();

  // Reload rather than trust the live SSE/poll update in the still-open guest
  // tab — a reload re-fetches session status fresh on mount. Retry a couple
  // times since a freshly-navigated dev-mode route can take a beat to compile.
  let reachedMenu = false;
  for (let attempt = 1; attempt <= 3 && !reachedMenu; attempt++) {
    await guestPage.reload();
    await guestPage.waitForLoadState("load");
    await guestPage.waitForTimeout(800);
    try {
      await guestPage.getByRole("button", { name: "Browse the menu" }).click({ timeout: 8_000 });
      await guestPage.waitForURL(/\/guest\/menu/, { timeout: 8_000 });
      reachedMenu = true;
    } catch {
      if (attempt === 3) console.warn("  guest never reached /guest/menu — approval likely didn't land in time");
    }
  }
  if (reachedMenu) {
    await guestPage.waitForLoadState("load");
    await guestPage.waitForTimeout(1200);
    await writeFile(
      path.join(OUTPUT_DIR, "guest-menu.png"),
      await applyFrame("iphone", await guestPage.screenshot()),
    );
    console.log("  saved guest-menu.png");
  }

  await guestCtx.close();
  await managerCtx.close();
}

// ── Orchestration ───────────────────────────────────────────────────────

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  const byRole = new Map<Role, Shot[]>();
  for (const shot of SHOTS) {
    if (!byRole.has(shot.role)) byRole.set(shot.role, []);
    byRole.get(shot.role)!.push(shot);
  }

  for (const [role, shots] of byRole) {
    console.log(`${role}:`);
    const isLaptop = shots[0].frame === "laptop";
    const ctx = await browser.newContext({
      viewport: isLaptop ? LAPTOP_VIEWPORT : IPHONE_VIEWPORT,
      deviceScaleFactor: SCALE,
      isMobile: !isLaptop,
      hasTouch: !isLaptop,
    });
    const page = await ctx.newPage();
    await login(page, role);
    for (const shot of shots) await capture(page, shot);
    await ctx.close();
  }

  await captureGuestFlow(browser);

  await browser.close();
  console.log(`\nDone — screenshots in ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
