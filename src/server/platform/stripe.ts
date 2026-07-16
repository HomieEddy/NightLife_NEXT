/**
 * Stripe integration — checkout sessions, customer portals, webhook
 * event processing. Prices are keyed on PlanConfig.id (starter/pro/enterprise).
 */
import Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { getLiveEnv } from "@/lib/env";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const env = getLiveEnv();
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}

export async function createCheckoutSession(
  db: PrismaClient,
  tenantId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: { tenantId: tenant.id },
    });
    customerId = customer.id;
    await db.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId },
  });

  return session.url!;
}

export async function createPortalSession(
  db: PrismaClient,
  tenantId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.stripeCustomerId) throw new Error("No Stripe customer for this tenant");

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

export function constructWebhookEvent(
  body: string,
  signature: string,
): Stripe.Event {
  const env = getLiveEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
}

function planFromPriceId(priceId: string, configs: { id: string }[]): string | null {
  return configs.find((c) => c.id === priceId)?.id ?? null;
}

export async function handleWebhookEvent(
  db: PrismaClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId) return;

      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription)?.id;

      if (subscriptionId) {
        await db.tenant.update({
          where: { id: tenantId },
          data: { stripeSubscriptionId: subscriptionId, status: "active" },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const tenant = await db.tenant.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!tenant) return;

      const priceId = subscription.items.data[0]?.price.id;
      const configs = await db.planConfig.findMany({ select: { id: true } });
      const plan = planFromPriceId(priceId ?? "", configs);

      const status = subscription.status === "active" ? "active"
        : subscription.status === "trialing" ? "trial"
        : "suspended";

      await db.tenant.update({
        where: { id: tenant.id },
        data: { ...(plan ? { plan } : {}), status },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db.tenant.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "suspended", stripeSubscriptionId: null },
      });
      break;
    }

    default:
      break;
  }
}
