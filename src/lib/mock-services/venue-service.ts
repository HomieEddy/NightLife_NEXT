/**
 * mockVenueService — the permanent demo-track implementation (AD-14). The live
 * build's venueService (src/lib/services/venue-service.ts) uses this type as
 * its contract; the real implementation lives in src/lib/live-services/.
 * Live mode issues signed QR tokens; demo keeps readable walkthrough slugs.
 */
import type { Venue, VenueTable, Zone } from "@/lib/types";
import { mockTables, mockVenue, mockZones } from "@/lib/mock-data/venue";
import { clone, delay, uid } from "./delay";

let venue: Venue = clone(mockVenue);
let zones: Zone[] = clone(mockZones);
let tables: VenueTable[] = clone(mockTables);

/**
 * Default floor-map layout: each zone gets a quadrant, tables flow in a
 * mini-grid inside it. Only fills tables without an explicit position.
 */
function ensureMapPositions() {
  const quadrants: Record<number, { x: number; y: number }> = {
    0: { x: 8, y: 10 },
    1: { x: 55, y: 10 },
    2: { x: 8, y: 58 },
    3: { x: 55, y: 58 },
  };
  zones.forEach((zone, zi) => {
    const origin = quadrants[zi % 4];
    const zoneTables = tables.filter((t) => t.zoneId === zone.id);
    zoneTables.forEach((table, ti) => {
      if (table.mapX !== undefined && table.mapY !== undefined) return;
      table.mapX = origin.x + (ti % 3) * 13;
      table.mapY = origin.y + Math.floor(ti / 3) * 15;
    });
  });
  // Orphaned zones beyond 4 or unassigned tables just stack bottom-left.
  tables.forEach((table, i) => {
    if (table.mapX === undefined || table.mapY === undefined) {
      table.mapX = 8 + (i % 6) * 8;
      table.mapY = 90;
    }
  });
}
ensureMapPositions();

export const mockVenueService = {
  async getVenue(): Promise<Venue> {
    await delay(250);
    return clone(venue);
  },

  /** Always-current snapshot for pricing math (fees). Async so live mode can hit the DB. */
  async getVenueSnapshot(): Promise<Venue> {
    return clone(venue);
  },

  async updateVenue(patch: Partial<Omit<Venue, "id">>): Promise<Venue> {
    await delay(500);
    venue = { ...venue, ...patch };
    return clone(venue);
  },

  async listZones(): Promise<Zone[]> {
    await delay();
    return clone(zones);
  },

  async createZone(input: Omit<Zone, "id" | "venueId" | "tableCount">): Promise<Zone> {
    await delay(400);
    const zone: Zone = { id: uid("zone"), venueId: venue.id, tableCount: 0, ...input };
    zones = [...zones, zone];
    return clone(zone);
  },

  async updateZone(zoneId: string, patch: Partial<Omit<Zone, "id" | "venueId">>): Promise<Zone | null> {
    await delay(400);
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    Object.assign(zone, patch);
    return clone(zone);
  },

  /** Fails if tables still reference the zone — reassign or delete them first. */
  async deleteZone(zoneId: string): Promise<{ ok: boolean; blockedBy?: number }> {
    await delay(400);
    const tableCount = tables.filter((t) => t.zoneId === zoneId).length;
    if (tableCount > 0) return { ok: false, blockedBy: tableCount };
    zones = zones.filter((z) => z.id !== zoneId);
    return { ok: true };
  },

  async createTable(input: Omit<VenueTable, "id" | "qrSlug">): Promise<VenueTable> {
    await delay(400);
    const table: VenueTable = {
      id: uid("t"),
      qrSlug: input.code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      ...input,
    };
    tables = [...tables, table];
    ensureMapPositions();
    return clone(table);
  },

  /** Persist a floor-map drag. Coordinates are % of canvas, clamped to 2–98. */
  async setTablePosition(tableId: string, x: number, y: number): Promise<void> {
    await delay(150);
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    table.mapX = Math.min(98, Math.max(2, x));
    table.mapY = Math.min(98, Math.max(2, y));
  },

  async updateTable(
    tableId: string,
    patch: Partial<Omit<VenueTable, "id" | "qrSlug">>,
  ): Promise<VenueTable | null> {
    await delay(400);
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;
    Object.assign(table, patch);
    return clone(table);
  },

  async deleteTable(tableId: string): Promise<void> {
    await delay(400);
    tables = tables.filter((t) => t.id !== tableId);
  },

  async listTables(zoneId?: string): Promise<VenueTable[]> {
    await delay();
    const result = zoneId ? tables.filter((t) => t.zoneId === zoneId) : tables;
    return clone(result);
  },

  async getTableBySlug(qrSlug: string): Promise<{ table: VenueTable; zone: Zone; venue: Venue } | null> {
    await delay(400);
    const table = tables.find((t) => t.qrSlug === qrSlug);
    if (!table) return null;
    const zone = zones.find((z) => z.id === table.zoneId);
    if (!zone) return null;
    return clone({ table, zone, venue });
  },

  async regenerateToken(tableId: string): Promise<void> {
    await delay(300);
    // In demo mode QR slugs are plain strings, not signed tokens — this is a no-op
    // that exercises the UI flow. Live mode bumps tokenVersion on the DB row.
  },

  async setTableStatus(tableId: string, status: VenueTable["status"]): Promise<VenueTable | null> {
    await delay(300);
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;
    table.status = status;
    return clone(table);
  },
};
