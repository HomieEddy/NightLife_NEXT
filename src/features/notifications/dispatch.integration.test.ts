import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  dispatch,
  dispatchPush,
  registerTemplate,
  registerSmsTemplate,
  resolveVenueLocale,
} from "./dispatch";
import { render } from "@react-email/components";
import { createElement } from "react";

async function makeVenue(raw: TestDb["rawClient"], id: string, guestLocale = "en") {
  await raw.organization.create({ data: { id, name: id, slug: `slug-${id}` } });
  await raw.venue.create({
    data: {
      id, address: "1 Test St", city: "Testville", timezone: "UTC", currency: "CAD",
      openingHours: [], serviceFees: [], guestLocale,
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      floorMap: { width: 16, height: 9 }, autoApproveGuests: false, logoInitials: "T",
      lastCallAutoFlagTables: true,
    },
  });
  await raw.tenant.create({
    data: { id, name: id, slug: `t-${id}`, plan: "starter", status: "active" },
  });
}

// The log drivers emit to stdout (EMAIL_DRIVER/SMS_DRIVER default "log") —
// sends are recorded in notification_logs regardless.
describe("notification dispatch (integration)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
    await makeVenue(testDb.rawClient, "disp-a", "fr");
    await makeVenue(testDb.rawClient, "disp-b");
    registerTemplate("test-notice", "Hello", () => render(createElement("div", null, "hello")));
    registerTemplate("test-notice:fr", "Bonjour", () => render(createElement("div", null, "bonjour")));
    registerSmsTemplate("test-notice", () => "sms body");
    // PIN confirmations double-deliver (email + SMS) — the sendBoth rule keys
    // on this exact template name; dispatch.ts registers its SMS variant.
    registerTemplate("reservation-confirmation", "Your PIN", () =>
      render(createElement("div", null, "pin")),
    );
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("resolveVenueLocale falls back to the venue's guestLocale", async () => {
    expect(await resolveVenueLocale(testDb.rawClient, "disp-a")).toBe("fr");
    expect(await resolveVenueLocale(testDb.rawClient, "disp-b")).toBe("en");
  });

  it("dispatches email + SMS for PIN confirmation (both channels when both contact points exist)", async () => {
    const result = await dispatch(testDb.rawClient, {
      venueId: "disp-a",
      template: "reservation-confirmation",
      recipients: [{ email: "guest@example.com", phone: "+15145550100" }],
      data: { reservationPin: "123456" },
      idempotencyKey: "ik-1",
    });
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);

    const logs = await testDb.rawClient.notificationLog.findMany({
      where: { venueId: "disp-a", template: "reservation-confirmation", recipient: { in: ["guest@example.com", "+15145550100"] } },
    });
    expect(logs).toHaveLength(2);
  });

  it("sends only email when only email exists", async () => {
    const result = await dispatch(testDb.rawClient, {
      venueId: "disp-a",
      template: "test-notice",
      recipients: [{ email: "email-only@example.com" }],
      data: {},
    });
    expect(result.sent).toBe(1);
  });

  it("is idempotent per (venue, template, recipient, key) — same key twice sends once", async () => {
    const payload = {
      venueId: "disp-a",
      template: "test-notice",
      recipients: [{ email: "once@example.com" }],
      data: {},
      idempotencyKey: "ik-dedup",
    };
    const first = await dispatch(testDb.rawClient, payload);
    const second = await dispatch(testDb.rawClient, payload);
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
  });

  it("does NOT suppress an identical send in ANOTHER venue (venue-scoped idempotency)", async () => {
    // Venue A sends (template, recipient, key); venue B sends the exact same
    // triple — B must still send. This is the regression for the missing
    // venueId filter in checkIdempotent.
    const payload = {
      venueId: "disp-a",
      template: "test-notice",
      recipients: [{ email: "shared@example.com" }],
      data: {},
      idempotencyKey: "ik-cross-venue",
    };
    await dispatch(testDb.rawClient, payload);
    const bResult = await dispatch(testDb.rawClient, { ...payload, venueId: "disp-b" });
    expect(bResult.sent).toBe(1);

    const logs = await testDb.rawClient.notificationLog.findMany({
      where: { recipient: "shared@example.com", template: "test-notice" },
    });
    expect(logs).toHaveLength(2);
  });

  it("resolves the locale from the venue when payload.locale is absent", async () => {
    // disp-a has guestLocale "fr" — the FR template variant is registered,
    // so the send succeeds (a missing variant would produce no email since
    // tpl is undefined and email is skipped).
    const result = await dispatch(testDb.rawClient, {
      venueId: "disp-a",
      template: "test-notice",
      recipients: [{ email: "franco@example.com" }],
      data: {},
    });
    expect(result.sent).toBe(1);
  });
});
