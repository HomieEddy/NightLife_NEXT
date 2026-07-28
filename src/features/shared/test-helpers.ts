import { expect } from "vitest";
import { getDb } from "./db";

/**
 * Canary for AD-3: a scoped db for one venue must never surface a row that
 * belongs to another venue. `findMarkerRow` should look up the same known
 * row (e.g. `db.zone.findUnique({ where: { id: markerZoneId } })`) against
 * whichever scoped db it's given. Call after creating that row for `ownVenueId`.
 */
export async function expectTenantIsolation<T>(
  ownVenueId: string,
  otherVenueId: string,
  findMarkerRow: (db: ReturnType<typeof getDb>) => Promise<T | null>,
): Promise<void> {
  const seenByOwner = await findMarkerRow(getDb({ venueId: ownVenueId }));
  const seenByOther = await findMarkerRow(getDb({ venueId: otherVenueId }));
  expect(seenByOwner).not.toBeNull();
  expect(seenByOther).toBeNull();
}
