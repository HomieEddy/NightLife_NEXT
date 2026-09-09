/**
 * Guest QR landing is unauthenticated and doesn't know the venue ahead of
 * time — the signed QR token is the only lookup key, so this is one of the
 * few legitimately cross-tenant reads (AD-14's platform exception).
 * In live mode, QR URLs carry a signed token (plan 06) verified by the
 * join route; lookup verifies the same token before returning table details.
 */
import { getPlatformDb } from "@/features/shared/db";
import { normalizeVenueLocale } from "@/features/shared/locale";
import { verifyTableToken } from "@/features/shared/table-token";
import type { Venue, VenueTable, Zone } from "@/lib/types";

export async function findTableByQrSlug(
  qrToken: string,
): Promise<{ table: VenueTable; zone: Zone; venue: Venue } | null> {
  const db = getPlatformDb();
  const separator = qrToken.indexOf(".");
  if (separator < 1) return null;
  const tableId = qrToken.slice(0, separator);
  const table = await db.venueTable.findUnique({ where: { id: tableId } });
  if (!table) return null;
  if (!verifyTableToken(qrToken, (id) => id === table.id ? table.tokenVersion : null).valid) {
    return null;
  }

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
      status: table.status === "out_of_service" ? "out-of-service" : table.status,
      qrSlug: qrToken,
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
      capacity: null,
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
      publicSlug: venueRow.publicSlug ?? venueRow.organization.slug,
      lastCallAutoFlagTables: venueRow.lastCallAutoFlagTables,
      tipPresets: venueRow.tipPresets as number[],
      defaultTipPct: venueRow.defaultTipPct,
      nightStartHour: venueRow.nightStartHour,
      nightEndHour: venueRow.nightEndHour,
      compThresholdCents: venueRow.compThresholdCents,
      minimumSpendWarningRatio: venueRow.minimumSpendWarningRatio,
      legalCapacity: venueRow.legalCapacity,
      occupancyWarnRatio: venueRow.occupancyWarnRatio,
      coatCheckEnabled: venueRow.coatCheckEnabled,
      doorRequiresIdCheck: venueRow.doorRequiresIdCheck,
      legalDrinkingAge: 18,
      guestLocale: normalizeVenueLocale(venueRow.guestLocale as string | null | undefined),
    },
  };
}
