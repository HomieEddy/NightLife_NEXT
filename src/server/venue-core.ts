/**
 * Shared venue/zone/table/shift logic used by both route handlers and
 * server actions — keeps the two entry points from drifting.
 */
import type { getDb } from "./db";
import type { Venue, VenueTable, Zone, TableStatus as VenueTableStatus } from "@/lib/types";
import type { zTableInput, zTablePatch, zVenuePatch, zZoneInput, zZonePatch } from "./schemas/venue";
import type { z } from "zod";
import { buildTableUrl } from "./table-token";

type ScopedDb = ReturnType<typeof getDb>;

interface OrgIdentity {
  name: string;
  slug: string;
}

function toVenue(
  row: {
    id: string;
    address: string;
    city: string;
    timezone: string;
    currency: string;
    openingHours: unknown;
    serviceFees: unknown;
    floorMap: unknown;
    autoApproveGuests: boolean;
    logoInitials: string;
    slaThresholds: unknown;
    lastCallAutoFlagTables: boolean;
    tipPresets: unknown;
    defaultTipPct: number;
    nightStartHour: number;
    nightEndHour: number;
    publicSlug?: string | null;
  },
  org: OrgIdentity,
): Venue {
  return {
    id: row.id,
    name: org.name,
    slug: org.slug,
    address: row.address,
    city: row.city,
    timezone: row.timezone,
    currency: row.currency as Venue["currency"],
    openingHours: row.openingHours as Venue["openingHours"],
    serviceFees: row.serviceFees as Venue["serviceFees"],
    floorMap: row.floorMap as Venue["floorMap"],
    autoApproveGuests: row.autoApproveGuests,
    logoInitials: row.logoInitials,
    slaThresholds: row.slaThresholds as Venue["slaThresholds"],
    publicSlug: row.publicSlug ?? org.slug,
    lastCallAutoFlagTables: row.lastCallAutoFlagTables,
    tipPresets: row.tipPresets as number[],
    defaultTipPct: row.defaultTipPct,
    nightStartHour: row.nightStartHour,
    nightEndHour: row.nightEndHour,
    // TODO(backend): plan 16 graduation — add compThresholdCents/minimumSpendWarningRatio
    // columns; until then the live track uses the same defaults as the demo seed.
    compThresholdCents: 10000,
    minimumSpendWarningRatio: 0.25,
    // TODO(backend): plan 17 graduation — add legalCapacity/occupancyWarnRatio/
    // coatCheckEnabled/doorRequiresIdCheck columns; door is demo-track only until then.
    legalCapacity: 400,
    occupancyWarnRatio: 0.9,
    coatCheckEnabled: false,
    doorRequiresIdCheck: false,
  };
}

function toZone(row: { id: string; venueId: string; name: string; description: string; color: string }, tableCount: number): Zone {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    description: row.description,
    color: row.color,
    tableCount,
  };
}

function toTable(row: {
  id: string;
  zoneId: string;
  code: string;
  label: string;
  seats: number;
  minimumSpend: number | null;
  status: string;
  qrSlug: string;
  tokenVersion: number;
  mapX: number | null;
  mapY: number | null;
}): VenueTable {
  return {
    id: row.id,
    zoneId: row.zoneId,
    code: row.code,
    label: row.label,
    seats: row.seats,
    minimumSpend: row.minimumSpend,
    status: row.status as VenueTableStatus,
    qrSlug: buildTableUrl(row.id, row.tokenVersion),
    mapX: row.mapX ?? undefined,
    mapY: row.mapY ?? undefined,
  };
}

export async function getVenue(db: ScopedDb, venueId: string): Promise<Venue | null> {
  const row = await db.venue.findUnique({ where: { id: venueId }, include: { organization: true } });
  if (!row) return null;
  return toVenue(row, row.organization);
}

export async function updateVenue(
  db: ScopedDb,
  venueId: string,
  patch: z.infer<typeof zVenuePatch>,
): Promise<Venue> {
  const { name, ...rest } = patch;
  if (name) {
    await db.organization.update({ where: { id: venueId }, data: { name } });
  }
  const row = await db.venue.update({
    where: { id: venueId },
    data: rest,
    include: { organization: true },
  });
  return toVenue(row, row.organization);
}

async function withTableCounts(db: ScopedDb, zones: { id: string; venueId: string; name: string; description: string; color: string }[]): Promise<Zone[]> {
  const counts = await db.venueTable.groupBy({ by: ["zoneId"], _count: { zoneId: true } });
  const countByZone = new Map(counts.map((c) => [c.zoneId, c._count.zoneId]));
  return zones.map((z) => toZone(z, countByZone.get(z.id) ?? 0));
}

export async function listZones(db: ScopedDb): Promise<Zone[]> {
  const rows = await db.zone.findMany({ orderBy: { createdAt: "asc" } });
  return withTableCounts(db, rows);
}

export async function createZone(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zZoneInput>,
): Promise<Zone> {
  const row = await db.zone.create({ data: { ...input, venueId } });
  return toZone(row, 0);
}

export async function updateZone(
  db: ScopedDb,
  zoneId: string,
  patch: z.infer<typeof zZonePatch>,
): Promise<Zone | null> {
  const row = await db.zone.update({ where: { id: zoneId }, data: patch }).catch(() => null);
  if (!row) return null;
  const [zone] = await withTableCounts(db, [row]);
  return zone;
}

/** Fails if tables still reference the zone — reassign or delete them first (INV-V1). */
export async function deleteZone(
  db: ScopedDb,
  zoneId: string,
): Promise<{ ok: boolean; blockedBy?: number }> {
  const tableCount = await db.venueTable.count({ where: { zoneId } });
  if (tableCount > 0) return { ok: false, blockedBy: tableCount };
  await db.zone.delete({ where: { id: zoneId } });
  return { ok: true };
}

export async function listTables(db: ScopedDb, zoneId?: string): Promise<VenueTable[]> {
  const rows = await db.venueTable.findMany({
    where: zoneId ? { zoneId } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTable);
}

function slugify(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * Default floor-map layout: each zone gets a quadrant, tables flow in a
 * mini-grid inside it. Only fills tables without an explicit position.
 * Ported verbatim from the mock's ensureMapPositions.
 */
export async function ensureMapPositions(db: ScopedDb): Promise<void> {
  const zones = await db.zone.findMany({ orderBy: { createdAt: "asc" } });
  const tables = await db.venueTable.findMany();
  const quadrants: Record<number, { x: number; y: number }> = {
    0: { x: 8, y: 10 },
    1: { x: 55, y: 10 },
    2: { x: 8, y: 58 },
    3: { x: 55, y: 58 },
  };
  const updates = new Map<string, { mapX: number; mapY: number }>();
  zones.forEach((zone, zi) => {
    const origin = quadrants[zi % 4];
    const zoneTables = tables.filter((t) => t.zoneId === zone.id);
    zoneTables.forEach((table, ti) => {
      if (table.mapX !== null && table.mapY !== null) return;
      updates.set(table.id, { mapX: origin.x + (ti % 3) * 13, mapY: origin.y + Math.floor(ti / 3) * 15 });
    });
  });
  tables.forEach((table, i) => {
    if ((table.mapX === null || table.mapY === null) && !updates.has(table.id)) {
      updates.set(table.id, { mapX: 8 + (i % 6) * 8, mapY: 90 });
    }
  });
  for (const [id, pos] of updates) {
    await db.venueTable.update({ where: { id }, data: pos });
  }
}

export async function createTable(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zTableInput>,
): Promise<VenueTable> {
  const row = await db.venueTable.create({
    data: { ...input, venueId, qrSlug: slugify(input.code) },
  });
  await ensureMapPositions(db);
  const fresh = await db.venueTable.findUnique({ where: { id: row.id } });
  return toTable(fresh!);
}

export async function updateTable(
  db: ScopedDb,
  tableId: string,
  patch: z.infer<typeof zTablePatch>,
): Promise<VenueTable | null> {
  const row = await db.venueTable.update({ where: { id: tableId }, data: patch }).catch(() => null);
  return row ? toTable(row) : null;
}

export async function deleteTable(db: ScopedDb, tableId: string): Promise<void> {
  await db.venueTable.delete({ where: { id: tableId } }).catch(() => undefined);
}

export async function setTableStatus(
  db: ScopedDb,
  tableId: string,
  status: VenueTableStatus,
): Promise<VenueTable | null> {
  const row = await db.venueTable.update({ where: { id: tableId }, data: { status } }).catch(() => null);
  return row ? toTable(row) : null;
}

/** Persist a floor-map drag. Coordinates are % of canvas, clamped to 2–98. */
export async function setTablePosition(
  db: ScopedDb,
  tableId: string,
  x: number,
  y: number,
): Promise<void> {
  const mapX = Math.min(98, Math.max(2, x));
  const mapY = Math.min(98, Math.max(2, y));
  await db.venueTable.update({ where: { id: tableId }, data: { mapX, mapY } }).catch(() => undefined);
}
