/**
 * Live history seed: wipes and regenerates 90 days of realistic operational
 * history for the single seeded venue, so every manager analytics/dashboard/
 * reports tab has consistent, non-empty data to show.
 *
 * Fresh-seed semantics: on every run, all history (orders, sessions, help
 * requests, reservations, events, promotions, rollups, saved reports, and
 * this script's own stock movements) is deleted and regenerated. Constants —
 * tenant, venue settings, users/staff, menu, floor map/zones/tables, happy
 * hour rules — are never touched; run `prisma/seed.ts` first if they don't
 * exist yet.
 *
 * Reuses the real pricing/analytics engine (computeOrderPricing from
 * src/server/pricing.ts, computeRollup/upsertRollup from
 * src/server/analytics-core.ts) instead of reimplementing that math, so
 * seeded orders and rollups can never drift from what the live app actually
 * computes — including happy-hour discounts, promo codes, and add-on pricing.
 *
 * Usage (against the docker compose Postgres):
 *   docker compose exec app-live npx tsx scripts/seed-live-history.ts
 * or from the host, with DATABASE_URL pointed at localhost:5432:
 *   npm run db:seed:live-history
 *
 * Takes a few minutes — ~38 open nights (Thu/Fri/Sat only) x realistic
 * session/order volume.
 */

import { EventStatus, ReservationStatus } from "@prisma/client";
import type { ModifierGroup } from "@/lib/types";
import { getDb, getRawPrisma } from "../src/features/shared/db";
import { computeRollup, upsertRollup } from "../src/features/analytics/analytics-core";
import { nightForDate, type NightConfig } from "../src/features/shared/night";
import { createReport, recordRun } from "../src/features/analytics/report-core";
import { toCents } from "../src/features/shared/money";
import { computeOrderPricing, type FeeInput, type PricingLineInput, type PromotionInput } from "../src/features/ordering/pricing";

const HISTORY_DAYS = 90;
const STOCK_MOVEMENT_PREFIX = "hist-sale-";

// ── Deterministic pseudo-random (seeded) — reproducible runs ──────────
let _seed = 42;
function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
/** Deterministic pick of N distinct elements (no repeats), using our own rand(). */
function pickDistinct<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

const GUEST_FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
  "Avery", "Blake", "Charlie", "Dana", "Emery", "Finley", "Harper",
  "Jamie", "Kai", "Logan", "Noel", "Reese", "Sage",
];
const HELP_TYPES = ["call-waiter", "refill-ice", "clean-table", "security", "bill"] as const;
const SETTLEMENT_METHODS = ["terminal", "cash", "house"] as const;
const RESERVATION_NAMES = [
  "Dubois party", "Martinez celebration", "Kim birthday", "Chen group",
  "O'Brien corporate", "Nakamura anniversary", "Singh engagement",
  "Thompson reunion", "Garcia bridal", "Wilson launch party",
];
const RESERVATION_CHANNELS = ["walk-in", "embed", "direct", "embed", "direct"] as const;

function seededPin(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * A Date whose UTC getters equal the venue-local wall clock at `instant`.
 * The live pricing engine's happy-hour matching (src/lib/happy-hour.ts) reads
 * `now.getDay()/getHours()/getMinutes()` using the process's local timezone —
 * the docker app container runs as UTC, so constructing the "now" we pass in
 * via Date.UTC(venue-local Y/M/D/H/M) makes those getters read correctly.
 */
function venueLocalAsUtc(instant: Date, timezone: string): Date {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = fmt.formatToParts(instant);
  const get = (t: Intl.DateTimeFormatPartTypes) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

/** Mirrors the unexported helper in src/server/order-core.ts. */
function venueFeeToInput(sf: { id: string; name: string; type: string; value: number }): FeeInput {
  if (sf.type === "flat") return { id: sf.id, name: sf.name, type: "flat", valueCents: toCents(sf.value) };
  return { id: sf.id, name: sf.name, type: "percentage", value: Math.round(sf.value * 100) };
}

function weightForRole(role: string): number {
  if (role === "runner") return 5;
  if (role === "bartender") return 2;
  return 1; // host
}

interface ResolvedModifier {
  groupId: string; optionId: string; kind: string;
  groupName: string; optionName: string; deltaCents: number; quantity: number;
  inventoryItemId?: string;
}

/** Washer add-ons are required on a real order — pick 1-2. Presentation upgrades are rare. */
function pickAddOns(groups: ModifierGroup[]): ResolvedModifier[] {
  const out: ResolvedModifier[] = [];
  for (const group of groups.filter((g) => g.isActive)) {
    if (group.kind === "washer") {
      const n = Math.min(group.maxSelections, randInt(1, 2));
      for (const option of pickDistinct(group.options.filter((o) => o.isActive), n)) {
        out.push({
          groupId: group.id, optionId: option.id, kind: group.kind,
          groupName: group.name, optionName: option.name,
          deltaCents: toCents(option.priceDelta), quantity: 1,
          inventoryItemId: option.inventoryItemId,
        });
      }
    } else if (group.kind === "presentation" && rand() < 0.18) {
      const upgrades = group.options.filter((o) => o.isActive && o.priceDelta > 0);
      if (upgrades.length > 0) {
        const option = pick(upgrades);
        out.push({
          groupId: group.id, optionId: option.id, kind: group.kind,
          groupName: group.name, optionName: option.name,
          deltaCents: toCents(option.priceDelta), quantity: 1,
          inventoryItemId: option.inventoryItemId,
        });
      }
    }
  }
  return out;
}

async function main() {
  const raw = getRawPrisma();

  const venueRow = await raw.venue.findFirst({ include: { organization: true } });
  if (!venueRow) {
    throw new Error("No venue found — run `npx tsx prisma/seed.ts` first to create the constant venue/menu/floor map.");
  }
  const venueId = venueRow.id;
  const db = getDb({ venueId });
  console.log(`Seeding history for ${venueRow.organization.name} (${venueId})`);

  const nightConfig: NightConfig = {
    timezone: venueRow.timezone,
    nightStartHour: venueRow.nightStartHour,
    nightEndHour: venueRow.nightEndHour,
  };
  const serviceFees = venueRow.serviceFees as unknown as { id: string; name: string; type: string; value: number }[];
  const feesInput: FeeInput[] = serviceFees.map(venueFeeToInput);
  const openingHours = venueRow.openingHours as unknown as { day: string }[];
  const openDayNames = new Set(openingHours.map((h) => h.day));
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const [zones, tables, categories, items, hhRules, members, packages] = await Promise.all([
    raw.zone.findMany({ where: { venueId } }),
    raw.venueTable.findMany({ where: { venueId } }),
    raw.menuCategory.findMany({ where: { venueId } }),
    raw.menuItem.findMany({ where: { venueId } }),
    raw.happyHourRule.findMany({ where: { venueId, isActive: true } }),
    raw.member.findMany({ where: { organizationId: venueId }, include: { user: { include: { staffProfile: true } } } }),
    raw.bottlePackage.findMany({ where: { venueId, isActive: true }, include: { components: true } }),
  ]);

  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
  const catModifierGroups = new Map(categories.map((c) => [c.id, (c.modifierGroups as unknown as ModifierGroup[]) ?? []]));
  const itemsById = new Map(items.map((i) => [i.id, i]));
  // Bottle-service line items only — washers are modifiers on real orders, not standalone lines.
  const orderableItems = items.filter((i) => (catNameById.get(i.categoryId) ?? "").toLowerCase() !== "washers");
  if (orderableItems.length === 0 || tables.length === 0 || zones.length === 0) {
    throw new Error("Venue has no menu items/tables/zones yet — run `npx tsx prisma/seed.ts` first.");
  }

  const happyHourInput = hhRules.map((r) => ({
    id: r.id, isActive: r.isActive, daysOfWeek: r.daysOfWeek,
    startTime: r.startTime, endTime: r.endTime,
    discountPct: r.discountPct, appliesToCategoryIds: r.appliesToCategoryIds,
  }));

  const deliveryStaff = members
    .filter((m) => m.user.staffProfile && m.user.staffProfile.role !== "manager")
    .map((m) => ({
      userId: m.userId, name: m.user.name, role: m.user.staffProfile!.role as string,
      assignedZoneIds: m.user.staffProfile!.assignedZoneIds,
    }));
  if (deliveryStaff.length === 0) {
    throw new Error("No non-manager staff found — orders need someone to attribute deliveries to.");
  }
  // Bartenders only work the bar, hosts only work VIP (per their assignedZoneIds);
  // runners have an empty list, meaning unrestricted — they cover every zone.
  function staffEligibleForZone(zoneId: string) {
    const eligible = deliveryStaff.filter((s) => s.assignedZoneIds.length === 0 || s.assignedZoneIds.includes(zoneId));
    return eligible.flatMap((s) => Array(weightForRole(s.role)).fill(s));
  }
  const runnerStaff = deliveryStaff.filter((s) => s.role === "runner");
  if (runnerStaff.length === 0) {
    throw new Error("No runners found — help requests need a runner to resolve them.");
  }
  console.log(`Delivery roster: ${deliveryStaff.map((s) => `${s.name} (${s.role}, zones: ${s.assignedZoneIds.join(",") || "any"})`).join(", ")}`);

  const zoneNameById = new Map(zones.map((z) => [z.id, z.name]));

  interface BuiltLine {
    menuItemId: string; packageId: string | null; name: string; priceCents: number;
    quantity: number; categoryId: string; modifiers: ResolvedModifier[];
    components: { menuItemId: string; quantity: number }[];
  }
  function buildOrderLine(): BuiltLine {
    if (packages.length > 0 && rand() < 0.12) {
      const pkg = pick(packages);
      const groups = (pkg.modifierGroups as unknown as ModifierGroup[]) ?? [];
      return {
        menuItemId: pkg.id, packageId: pkg.id, name: pkg.name, priceCents: pkg.priceCents,
        quantity: 1, categoryId: "packages", modifiers: pickAddOns(groups),
        components: pkg.components.map((c) => ({ menuItemId: c.itemId, quantity: c.quantity })),
      };
    }
    const item = pick(orderableItems);
    const groups = catModifierGroups.get(item.categoryId) ?? [];
    return {
      menuItemId: item.id, packageId: null, name: item.name, priceCents: item.priceCents,
      quantity: 1, categoryId: item.categoryId, modifiers: pickAddOns(groups),
      components: [{ menuItemId: item.id, quantity: 1 }],
    };
  }

  // ── Wipe previous history (constants untouched) ──────────────────────
  console.log("Wiping previous history...");
  await db.order.deleteMany({}); // cascades OrderItem, FeeLine
  await db.guestSession.deleteMany({}); // cascades HelpRequest
  await db.venueEvent.deleteMany({}); // cascades EventGuest
  await db.reservation.deleteMany({});
  await db.promotion.deleteMany({});
  await db.nightlyRollup.deleteMany({});
  await db.savedReport.deleteMany({}); // cascades ReportRun
  await db.stockMovement.deleteMany({ where: { id: { startsWith: STOCK_MOVEMENT_PREFIX } } });

  // ── Date range: last 90 days, ending yesterday ────────────────────────
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (HISTORY_DAYS - 1));

  // ── Promotions — created up front so orders can apply them sporadically ──
  const promoDefs = [
    { code: "WELCOME20", name: "Welcome 20%", type: "percentage", value: 20, daysAgo: 80, duration: 30 },
    { code: "FRIENDS10", name: "Friends & Family", type: "percentage", value: 10, daysAgo: 45, duration: 20 },
    { code: "VIP50OFF", name: "VIP $50 Off", type: "flat", value: 50, daysAgo: 20, duration: 25 },
    { code: "WEEKEND15", name: "Weekend Special", type: "percentage", value: 15, daysAgo: -2, duration: 10 },
    { code: "NYE25", name: "New Year Preview", type: "percentage", value: 25, daysAgo: -20, duration: 5 },
  ];
  const promotions: { id: string; code: string; type: string; value: number; appliesToCategoryIds: string[]; startsAt: Date; endsAt: Date }[] = [];
  for (const promo of promoDefs) {
    const startsAt = new Date(endDate);
    startsAt.setDate(startsAt.getDate() - promo.daysAgo);
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + promo.duration);

    const row = await db.promotion.create({
      data: {
        venueId, code: promo.code, name: promo.name, type: promo.type, value: promo.value,
        appliesToCategoryIds: [], startsAt, endsAt, redemptionCount: 0,
      },
    });
    promotions.push({ id: row.id, code: row.code, type: row.type, value: row.value, appliesToCategoryIds: row.appliesToCategoryIds, startsAt, endsAt });
  }
  console.log(`+ ${promotions.length} promotions seeded`);
  const promoRedemptions = new Map<string, number>();

  let totalOrders = 0, totalSessions = 0, totalReservations = 0, totalHelpRequests = 0, nightsSeeded = 0;
  let stockMovementSeq = 0;

  const d = new Date(startDate);
  while (d <= endDate) {
    const dayName = dayNames[d.getDay()];
    if (!openDayNames.has(dayName)) {
      d.setDate(d.getDate() + 1);
      continue;
    }

    const nightLabel = isoDate(d);
    const night = nightForDate(nightLabel, nightConfig);
    const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Fri/Sat
    const sessionsTonight = isWeekend ? randInt(10, 20) : randInt(5, 12);

    for (let si = 0; si < sessionsTonight; si++) {
      const table = pick(tables);
      const guestName = pick(GUEST_FIRST_NAMES);
      const partySize = randInt(2, 8);

      // Guests arrive 22:00-01:00 local, stay 1-3 hours — offset from night.start (venue-local nightStartHour).
      const hoursAfterOpen = randInt(4, 7); // nightStartHour=18 + 4..7h = 22:00-01:00
      const sessionStart = new Date(night.start.getTime() + hoursAfterOpen * 3_600_000 + randInt(0, 59) * 60_000);
      const sessionEnd = new Date(sessionStart.getTime() + randInt(1, 3) * 3_600_000);

      const session = await db.guestSession.create({
        data: {
          venueId,
          tableId: table.id,
          tableCode: table.code,
          zoneName: zoneNameById.get(table.zoneId) ?? "",
          displayName: guestName,
          partySize,
          status: "closed",
          settlementMethod: pick([...SETTLEMENT_METHODS]),
          settledExternallyAt: sessionEnd,
          createdAt: sessionStart,
        },
      });
      totalSessions++;

      const ordersInSession = randInt(1, 3);
      for (let oi = 0; oi < ordersInSession; oi++) {
        const orderTime = new Date(sessionStart.getTime() + oi * randInt(15, 40) * 60_000);
        const localNow = venueLocalAsUtc(orderTime, nightConfig.timezone);

        const lineCount = randInt(1, 3);
        const lines = Array.from({ length: lineCount }, buildOrderLine);
        const pricingLines: PricingLineInput[] = lines.map((l) => ({
          menuItemId: l.menuItemId, name: l.name, priceCents: l.priceCents, quantity: l.quantity,
          categoryId: l.categoryId,
          modifiers: l.modifiers.map((m) => ({ groupName: m.groupName, optionName: m.optionName, deltaCents: m.deltaCents, quantity: m.quantity })),
          packageId: l.packageId ?? undefined,
        }));

        const eligiblePromos = promotions.filter((p) => orderTime >= p.startsAt && orderTime <= p.endsAt);
        const appliedPromo = eligiblePromos.length > 0 && rand() < 0.1 ? pick(eligiblePromos) : undefined;
        const promotionInput: PromotionInput | undefined = appliedPromo
          ? { type: appliedPromo.type as "percentage" | "flat", value: appliedPromo.value, appliesToCategoryIds: appliedPromo.appliesToCategoryIds }
          : undefined;

        const basePricing = computeOrderPricing({
          lines: pricingLines, fees: feesInput, happyHourRules: happyHourInput,
          promotion: promotionInput, tipCents: 0, now: localNow,
        });
        const tipPct = pick([0, 0, 15, 18, 20]);
        const tipCents = Math.round((basePricing.discountedSubtotalCents * tipPct) / 100);
        const pricing = tipCents === 0 ? basePricing : computeOrderPricing({
          lines: pricingLines, fees: feesInput, happyHourRules: happyHourInput,
          promotion: promotionInput, tipCents, now: localNow,
        });

        const isCancelled = rand() < 0.05; // 5% of historical orders never fulfilled
        const status = isCancelled ? "cancelled" : "delivered";
        const acceptWaitMinutes = randInt(1, 4);
        const fulfillmentMinutes = randInt(acceptWaitMinutes + 3, 16);
        const acceptedAt = new Date(orderTime.getTime() + acceptWaitMinutes * 60_000);
        const updatedAt = new Date(orderTime.getTime() + fulfillmentMinutes * 60_000);
        const claimedStaff = pick(staffEligibleForZone(table.zoneId));
        const orderCode = `${String.fromCharCode(65 + (totalOrders % 26))}-${String(totalOrders + 1).padStart(3, "0")}`;

        const order = await db.order.create({
          data: {
            venueId,
            code: orderCode,
            sessionId: session.id,
            tableId: table.id,
            tableCode: table.code,
            zoneId: table.zoneId,
            zoneName: zoneNameById.get(table.zoneId) ?? "",
            guestName,
            subtotalCents: pricing.subtotalCents,
            discountCents: pricing.discountCents + pricing.promotionCents,
            totalFeeCents: pricing.totalFeeCents,
            tipCents: pricing.tipCents,
            totalCents: pricing.totalCents,
            promotionId: appliedPromo?.id ?? null,
            promotionCode: appliedPromo?.code ?? null,
            promotionCents: pricing.promotionCents,
            status,
            placedAt: orderTime,
            updatedAt,
            acceptedAt: isCancelled ? null : acceptedAt,
            claimedByStaffId: isCancelled ? null : claimedStaff.userId,
            claimedByStaffName: isCancelled ? null : claimedStaff.name,
            claimedAt: isCancelled ? null : acceptedAt,
            items: {
              create: lines.map((l) => ({
                menuItemId: l.menuItemId,
                name: l.name,
                quantity: l.quantity,
                unitCents: l.priceCents,
                modifiers: l.modifiers.map((m) => ({
                  groupId: m.groupId, optionId: m.optionId, kind: m.kind,
                  groupName: m.groupName, optionName: m.optionName,
                  deltaCents: m.deltaCents, quantity: m.quantity,
                })),
                packageId: l.packageId,
              })),
            },
            feeLines: {
              create: pricing.feeLines.map((fl) => ({
                feeId: fl.feeId, feeName: fl.feeName, feeType: fl.feeType,
                feeValue: fl.feeValue, amountCents: fl.amountCents,
              })),
            },
          },
        });
        totalOrders++;
        if (appliedPromo) promoRedemptions.set(appliedPromo.id, (promoRedemptions.get(appliedPromo.id) ?? 0) + 1);

        if (!isCancelled) {
          // Mirror order-core.ts's stock draw-down: package/base components by
          // line quantity, add-on (washer) inventory items by modifier quantity.
          const draws = new Map<string, number>();
          for (const line of lines) {
            for (const component of line.components) {
              draws.set(component.menuItemId, (draws.get(component.menuItemId) ?? 0) + component.quantity * line.quantity);
            }
            for (const modifier of line.modifiers) {
              if (!modifier.inventoryItemId) continue;
              draws.set(modifier.inventoryItemId, (draws.get(modifier.inventoryItemId) ?? 0) + modifier.quantity);
            }
          }
          for (const [menuItemId, qty] of draws) {
            stockMovementSeq++;
            await raw.stockMovement.create({
              data: {
                id: `${STOCK_MOVEMENT_PREFIX}${nightLabel}-${stockMovementSeq}`,
                venueId,
                menuItemId,
                itemName: itemsById.get(menuItemId)?.name ?? menuItemId,
                type: "sale",
                delta: -qty,
                note: `Order ${order.code}`,
                createdAt: orderTime,
              },
            });
          }
        }
      }

      if (rand() < 0.35) {
        // Runners are the busser role — they're the ones who field these on the floor.
        const resolver = pick(runnerStaff);
        const status = rand() < 0.85 ? "resolved" : "acknowledged";
        const resolveMinutes = randInt(2, 9);
        await db.helpRequest.create({
          data: {
            venueId,
            sessionId: session.id,
            tableCode: table.code,
            zoneName: zoneNameById.get(table.zoneId) ?? "",
            guestName,
            type: pick([...HELP_TYPES]),
            status,
            resolvedByStaffId: resolver.userId,
            resolvedByStaffName: resolver.name,
            createdAt: sessionStart,
            updatedAt: new Date(sessionStart.getTime() + resolveMinutes * 60_000),
          },
        });
        totalHelpRequests++;
      }
    }

    // Reservations — a few per open night, mostly resolved (this is history).
    const resCount = isWeekend ? randInt(2, 6) : randInt(0, 3);
    for (let ri = 0; ri < resCount; ri++) {
      const resTime = new Date(night.start.getTime() + 4 * 3_600_000); // 22:00 local
      const nameIdx = (totalReservations + ri) % RESERVATION_NAMES.length;
      const isPublic = rand() < 0.4;
      const table = rand() < 0.7 ? pick(tables) : null;
      const status = pick([ReservationStatus.completed, ReservationStatus.completed, ReservationStatus.completed, ReservationStatus.cancelled]);
      const resId = `hist-res-${nightLabel}-${ri}`;

      await db.reservation.create({
        data: {
          id: resId,
          venueId,
          guestName: RESERVATION_NAMES[nameIdx],
          partySize: randInt(4, 12),
          startsAt: resTime,
          status,
          zoneId: table?.zoneId ?? pick(zones).id,
          tableId: table?.id ?? null,
          source: isPublic ? "public" : "manager",
          channel: isPublic ? pick([...RESERVATION_CHANNELS]) : "walk-in",
          reservationPin: status === "completed" && table ? seededPin(resId) : null,
          createdAt: resTime,
        },
      });
      totalReservations++;
    }

    // ── Nightly rollup — computed by the real analytics engine, not us ──
    const rollupData = await computeRollup(db, venueId, night);
    await upsertRollup(raw, venueId, night.label, rollupData);
    nightsSeeded++;

    if (nightsSeeded % 10 === 0) console.log(`  ...${nightsSeeded} nights seeded (${isoDate(d)})`);
    d.setDate(d.getDate() + 1);
  }

  console.log(`${nightsSeeded} nights: ${totalOrders} orders, ${totalSessions} sessions, ${totalReservations} reservations, ${totalHelpRequests} help requests`);

  // ── Apply real redemption counts to the promotions actually used ──────
  for (const [promoId, count] of promoRedemptions) {
    await raw.promotion.update({ where: { id: promoId }, data: { redemptionCount: count } });
  }
  console.log(`  promo redemptions: ${[...promoRedemptions.entries()].map(([id, n]) => `${promotions.find((p) => p.id === id)?.code}=${n}`).join(", ") || "none"}`);

  // ── Upcoming reservations (tonight + next open nights) ────────────────
  let upcomingCount = 0;
  for (let dayOffset = 0; dayOffset < 7 && upcomingCount < 6; dayOffset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);
    if (!openDayNames.has(dayNames[day.getDay()])) continue;

    const night = nightForDate(isoDate(day), nightConfig);
    const resTime = new Date(night.start.getTime() + 4 * 3_600_000);
    const table = pick(tables);
    const nameIdx = upcomingCount % RESERVATION_NAMES.length;
    const status = dayOffset === 0 ? ReservationStatus.confirmed : pick([ReservationStatus.requested, ReservationStatus.confirmed]);
    const resId = `hist-res-upcoming-${dayOffset}`;

    await db.reservation.create({
      data: {
        id: resId,
        venueId,
        guestName: RESERVATION_NAMES[nameIdx],
        partySize: randInt(4, 10),
        startsAt: resTime,
        status,
        zoneId: table.zoneId,
        tableId: table.id,
        source: rand() < 0.5 ? "public" : "manager",
        channel: rand() < 0.5 ? "embed" : "walk-in",
        reservationPin: status === "confirmed" ? seededPin(resId) : null,
        createdAt: new Date(resTime.getTime() - 86_400_000),
      },
    });
    upcomingCount++;
  }
  console.log(`+ ${upcomingCount} upcoming reservations`);

  // ── Events across the 90-day window ────────────────────────────────
  const eventDefs = [
    { suffix: "latin-night", name: "Latin Night", daysAgo: 84, capacity: 200, status: EventStatus.ended },
    { suffix: "ladies-night", name: "Ladies' Night", daysAgo: 63, capacity: 150, status: EventStatus.ended },
    { suffix: "dj-showcase", name: "DJ Showcase", daysAgo: 42, capacity: 250, status: EventStatus.ended },
    { suffix: "industry-night", name: "Industry Night", daysAgo: 21, capacity: 180, status: EventStatus.ended },
    { suffix: "anniversary", name: "Velvet Anniversary", daysAgo: 7, capacity: 300, status: EventStatus.ended },
    { suffix: "vip-launch", name: "VIP Launch Party", daysAgo: -3, capacity: 120, status: EventStatus.published },
    { suffix: "summer-solstice", name: "Summer Solstice", daysAgo: -14, capacity: 300, status: EventStatus.draft },
  ];
  for (const ev of eventDefs) {
    const startsAt = new Date(endDate);
    startsAt.setDate(startsAt.getDate() - ev.daysAgo);
    startsAt.setHours(22, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(endsAt.getHours() + 5);
    const eventId = `hist-event-${ev.suffix}`;

    await db.venueEvent.create({
      data: {
        id: eventId,
        venueId,
        name: ev.name,
        description: `${ev.name} at ${venueRow.organization.name}`,
        startsAt, endsAt,
        zoneId: pick(zones).id,
        capacity: ev.capacity,
        status: ev.status,
        guestlistEnabled: ev.status !== EventStatus.draft,
      },
    });

    if (ev.status !== EventStatus.draft) {
      const guestCount = Math.floor(ev.capacity * (0.5 + rand() * 0.4));
      const guestRows = Array.from({ length: guestCount }, (_, gi) => ({
        eventId,
        name: `Guest ${gi + 1}`,
        partySize: randInt(1, 4),
        status: ev.status === EventStatus.ended
          ? pick(["confirmed", "confirmed", "confirmed", "checked_in", "checked_in", "checked_in", "checked_in", "no_show"])
          : pick(["invited", "invited", "confirmed", "confirmed", "confirmed"]),
      }));
      await raw.eventGuest.createMany({ data: guestRows });
    }
  }
  console.log(`+ ${eventDefs.length} events seeded`);

  // ── Saved reports (Reports tab) ────────────────────────────────────
  const weeklyReport = await createReport(db, venueId, {
    name: "Weekly Revenue Summary",
    metrics: ["revenue", "zones", "top-items"],
    rangeDays: 7,
    schedule: null,
  });
  await recordRun(db, weeklyReport.id, isoDate(startDate), isoDate(endDate), "manual");

  const monthlyReport = await createReport(db, venueId, {
    name: "Monthly Ops Report",
    metrics: ["revenue", "staff", "inventory", "reservations", "events"],
    rangeDays: 30,
    schedule: { frequency: "monthly", recipient: "amara@velvetmtl.club" },
  });
  await recordRun(db, monthlyReport.id, isoDate(startDate), isoDate(endDate), "manual");
  console.log("+ 2 saved reports seeded");

  console.log("\nLive history seed complete.");
  await raw.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
