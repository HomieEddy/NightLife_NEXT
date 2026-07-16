import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Billing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/server/db");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ctx = sessionToDbContext(auth.session);
  const db = getPlatformDb();
  const tenant = await db.tenant.findFirst({ where: { id: ctx.venueId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const subscription = {
    plan: tenant.plan,
    status: tenant.status === "active" ? "active" : tenant.status === "trial" ? "trial" : "past_due",
    renewsAt: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    paymentMethod: tenant.stripeCustomerId
      ? { brand: "Card", last4: "••••", expires: "on file" }
      : null,
  };

  return NextResponse.json(subscription);
}

async function livePATCH(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/server/db");
  const { createCheckoutSession } = await import("@/server/platform/stripe");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ctx = sessionToDbContext(auth.session);
  const body = await request.json();
  const plan = body.plan as string;

  const db = getPlatformDb();
  const planConfig = await db.planConfig.findUnique({ where: { id: plan } });
  if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const tenant = await db.tenant.findFirst({ where: { id: ctx.venueId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  if (tenant.stripeSubscriptionId) {
    // Existing subscriber — update via Stripe portal
    const { createPortalSession } = await import("@/server/platform/stripe");
    const url = await createPortalSession(db, tenant.id, request.headers.get("origin") ?? "/");
    return NextResponse.json({ portalUrl: url });
  }

  // New subscription — create checkout session
  const origin = request.headers.get("origin") ?? "";
  const url = await createCheckoutSession(
    db,
    tenant.id,
    plan,
    `${origin}/manager/subscription?success=true`,
    `${origin}/manager/subscription?cancelled=true`,
  );
  return NextResponse.json({ checkoutUrl: url });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
