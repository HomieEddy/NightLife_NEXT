import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Billing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/server/db");
  const { getLiveEnv } = await import("@/lib/env");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const env = getLiveEnv();
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json([]);

  const ctx = sessionToDbContext(auth.session);
  const db = getPlatformDb();
  const tenant = await db.tenant.findFirst({ where: { id: ctx.venueId } });
  if (!tenant?.stripeCustomerId) return NextResponse.json([]);

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const stripeInvoices = await stripe.invoices.list({
    customer: tenant.stripeCustomerId,
    limit: 12,
  });

  const invoices = stripeInvoices.data.map((inv) => ({
    id: inv.number ?? inv.id,
    date: new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10),
    amount: (inv.amount_paid ?? 0) / 100,
    status: inv.status === "paid" ? "paid" as const : "open" as const,
  }));

  return NextResponse.json(invoices);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
