import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json(
    { error: "Push subscriptions are disabled in demo mode" },
    { status: 404 },
  );
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { zPushSubscribe } = await import("@/features/notifications/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const parsed = zPushSubscribe.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const existing = await db.pushSubscription.findUnique({
    where: { endpoint: parsed.data.endpoint },
  });
  if (existing) {
    await db.pushSubscription.update({
      where: { id: existing.id },
      data: { expired: false, keys: parsed.data.keys },
    });
    return NextResponse.json({ subscribed: true });
  }

  await db.pushSubscription.create({
    data: {
      venueId,
      userId: auth.session.user.id,
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return NextResponse.json({ subscribed: true });
}

async function liveDELETE(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint) return NextResponse.json({ error: "endpoint is required" }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  await db.pushSubscription.updateMany({
    where: { endpoint, userId: auth.session.user.id },
    data: { expired: true },
  });

  return NextResponse.json({ unsubscribed: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
