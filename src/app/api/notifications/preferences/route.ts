import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json(
    { error: "Notification preferences are disabled in demo mode" },
    { status: 404 },
  );
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const prefs = await db.notificationPreference.findMany({
    where: { userId: auth.session.user.id },
  });

  const quietHours = await db.userQuietHours.findUnique({
    where: { venueId_userId: { venueId, userId: auth.session.user.id } },
  });

  return NextResponse.json({
    preferences: prefs.map((p) => ({
      eventType: p.eventType,
      channel: p.channel,
      enabled: p.enabled,
    })),
    quietHours: quietHours
      ? { startTime: quietHours.startTime, endTime: quietHours.endTime, timezone: quietHours.timezone }
      : null,
  });
}

async function livePUT(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { zPreferencesPut } = await import("@/server/schemas/notifications");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const parsed = zPreferencesPut.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const existing = await db.notificationPreference.findMany({
    where: { userId: auth.session.user.id },
  });

  const existingKey = (e: typeof existing[number]) => `${e.eventType}:${e.channel}`;
  const existingMap = new Map(existing.map((e) => [existingKey(e), e]));
  const incomingKeys = new Set(parsed.data.preferences.map((p) => `${p.eventType}:${p.channel}`));

  for (const e of existing) {
    if (!incomingKeys.has(existingKey(e))) {
      await db.notificationPreference.delete({ where: { id: e.id } });
    }
  }

  for (const pref of parsed.data.preferences) {
    const ek = existingMap.get(`${pref.eventType}:${pref.channel}`);
    if (ek) {
      if (ek.enabled !== pref.enabled) {
        await db.notificationPreference.update({
          where: { id: ek.id },
          data: { enabled: pref.enabled },
        });
      }
    } else {
      await db.notificationPreference.create({
        data: {
          venueId,
          userId: auth.session.user.id,
          eventType: pref.eventType,
          channel: pref.channel,
          enabled: pref.enabled,
        },
      });
    }
  }

  const updated = await db.notificationPreference.findMany({
    where: { userId: auth.session.user.id },
  });

  return NextResponse.json({
    preferences: updated.map((p) => ({
      eventType: p.eventType,
      channel: p.channel,
      enabled: p.enabled,
    })),
  });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PUT = isDemoMode() ? demoHandler : livePUT;
