/**
 * Extracts the venue ID from a guest's httpOnly session cookie.
 * Returns null if the cookie is missing or the session doesn't exist.
 */
import type { NextRequest } from "next/server";
import { getPlatformDb } from "./db";

export async function getGuestVenueId(request: NextRequest): Promise<string | null> {
  const sessionId = request.cookies.get("nln-guest-session")?.value;
  if (!sessionId) return null;

  const db = getPlatformDb();
  const row = await db.guestSession.findUnique({
    where: { id: sessionId },
    select: { venueId: true },
  });
  return row?.venueId ?? null;
}
