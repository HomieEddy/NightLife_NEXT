import type { NextRequest } from "next/server";
import { getRawPrisma } from "@/server/db";

export async function getGuestSession(request: NextRequest) {
  const sessionId = request.cookies.get("nln-guest-session")?.value;
  if (!sessionId) return null;

  return getRawPrisma().guestSession.findUnique({
    where: { id: sessionId },
  });
}

export async function getGuestVenueId(request: NextRequest) {
  return (await getGuestSession(request))?.venueId ?? null;
}

export async function getGuestAccess(request: NextRequest) {
  const session = await getGuestSession(request);
  if (!session || session.status === "pending" || session.status === "denied") return null;
  return session;
}
