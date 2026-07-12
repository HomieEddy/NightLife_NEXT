"use server";

import { requireApiArea, sessionToDbContext } from "@/server/auth-helpers";
import { getDb } from "@/server/db";
import { setTablePosition as coreSetTablePosition, setTableStatus as coreSetTableStatus } from "@/server/venue-core";
import { zTablePosition, zTableStatus } from "@/server/schemas/venue";
import type { VenueTable } from "@/lib/types";

export async function setTableStatusAction(
  tableId: string,
  status: VenueTable["status"],
): Promise<{ data: VenueTable } | { error: string }> {
  const auth = await requireApiArea("staff");
  if ("error" in auth) return { error: auth.error };

  const parsed = zTableStatus.safeParse(status);
  if (!parsed.success) return { error: parsed.error.message };

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const table = await coreSetTableStatus(db, tableId, parsed.data);
  if (!table) return { error: "Table not found" };
  return { data: table };
}

export async function setTablePositionAction(
  tableId: string,
  x: number,
  y: number,
): Promise<{ data: true } | { error: string }> {
  const auth = await requireApiArea("manager");
  if ("error" in auth) return { error: auth.error };

  const parsed = zTablePosition.safeParse({ x, y });
  if (!parsed.success) return { error: parsed.error.message };

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  await coreSetTablePosition(db, tableId, parsed.data.x, parsed.data.y);
  return { data: true };
}
