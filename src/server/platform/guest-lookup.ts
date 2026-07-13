/**
 * Guest QR landing is unauthenticated and doesn't know the venue ahead of
 * time — the qrSlug itself is the only lookup key, so this is one of the
 * few legitimately cross-tenant reads (AD-14's platform exception).
 * In live mode, QR URLs carry a signed token (plan 06) verified by the
 * join route; this lookup still handles the slug → table resolution.
 */
import { getPlatformDb } from "@/server/db";
import type { Venue, VenueTable, Zone } from "@/lib/types";

export async function findTableByQrSlug(
  qrSlug: string,
): Promise<{ table: VenueTable; zone: Zone; venue: Venue } | null> {
  const db = getPlatformDb();
  const table = await db.venueTable.findUnique({ where: { qrSlug } });
  if (!table) return null;

  const [zone, tableCount, venueRow] = await Promise.all([
    db.zone.findUnique({ where: { id: table.zoneId } }),
    db.venueTable.count({ where: { zoneId: table.zoneId } }),
    db.venue.findUnique({ where: { id: table.venueId }, include: { organization: true } }),
  ]);
  if (!zone || !venueRow) return null;

  return {
    table: {
      id: table.id,
      zoneId: table.zoneId,
      code: table.code,
      label: table.label,
      seats: table.seats,
      minimumSpend: table.minimumSpend,
      status: table.status,
      qrSlug: table.qrSlug,
      mapX: table.mapX ?? undefined,
      mapY: table.mapY ?? undefined,
    },
    zone: {
      id: zone.id,
      venueId: zone.venueId,
      name: zone.name,
      description: zone.description,
      color: zone.color,
      tableCount,
    },
    venue: {
      id: venueRow.id,
      name: venueRow.organization.name,
      slug: venueRow.organization.slug,
      address: venueRow.address,
      city: venueRow.city,
      timezone: venueRow.timezone,
      currency: venueRow.currency as Venue["currency"],
      openingHours: venueRow.openingHours as unknown as Venue["openingHours"],
      serviceFees: venueRow.serviceFees as unknown as Venue["serviceFees"],
      floorMap: venueRow.floorMap as unknown as Venue["floorMap"],
      autoApproveGuests: venueRow.autoApproveGuests,
      logoInitials: venueRow.logoInitials,
      slaThresholds: venueRow.slaThresholds as unknown as Venue["slaThresholds"],
      lastCallAutoFlagTables: venueRow.lastCallAutoFlagTables,
    },
  };
}
