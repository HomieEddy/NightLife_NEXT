/**
 * Notification dispatch core — resolves channels per recipient, calls each
 * transport, records one NotificationLog row per attempt. The log is both the
 * audit trail and the idempotency check (same (channel, template, recipient,
 * idempotencyKey) only sends once).
 *
 * Plan 26: recipients with a phone and no email get SMS; with both get both
 * for PIN delivery (the PIN is the one message worth double-delivery);
 * email-only otherwise.
 *
 * Plan 28: dispatchPush queries all active push subscriptions for the venue,
 * checks per-user per-event preferences, and sends via the push transport.
 * Dead subscriptions (410 Gone) self-clean.
 */
import type { PrismaClient } from "@prisma/client";
import { type DispatchPayload, type PushDispatchPayload } from "./types";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { sendPush, expireSubscription } from "./push";
import { reservationPinSms, reservationConfirmationSms, reservationReminderSms } from "./sms-templates";

type RenderFn = (props: Record<string, unknown>) => ReturnType<typeof import("@react-email/components").render>;

const templates: Record<string, { subject: string; render: RenderFn }> = {};
const smsTemplateFns: Record<string, (data: Record<string, unknown>) => string> = {};

export function registerTemplate(name: string, subject: string, render: RenderFn) {
  templates[name] = { subject, render };
}

export function registerSmsTemplate(name: string, fn: (data: Record<string, unknown>) => string) {
  smsTemplateFns[name] = fn;
}

// Register built-in SMS templates
registerSmsTemplate("reservation-confirmation", (d) =>
  reservationPinSms(d.venueName as string, (d.reservationPin ?? "••••••") as string),
);
registerSmsTemplate("reservation-reminder", (d) =>
  reservationReminderSms(d.venueName as string, d.guestName as string, d.time as string),
);

async function logSend(
  prisma: PrismaClient,
  params: {
    venueId: string;
    channel: string;
    template: string;
    recipient: string;
    ok: boolean;
    providerId?: string;
    error?: string;
    ik?: string;
    data?: Record<string, unknown>;
  },
) {
  await prisma.notificationLog.create({
    data: {
      venueId: params.venueId,
      channel: params.channel,
      template: params.template,
      recipient: params.recipient,
      status: params.ok ? "sent" : "failed",
      providerId: params.providerId,
      error: params.error,
      meta: { ik: params.ik, ...(params.data ?? {}) },
    },
  });
}

async function checkIdempotent(prisma: PrismaClient, template: string, recipient: string, ik: string): Promise<boolean> {
  const existing = await prisma.notificationLog.findFirst({
    where: { template, recipient, status: "sent" },
  });
  return !!(existing && existing.meta && (existing.meta as Record<string, unknown>).ik === ik);
}

export async function dispatch(
  prisma: PrismaClient,
  payload: DispatchPayload,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const hasTemplate = templates[payload.template];

  for (const recipient of payload.recipients) {
    const sendBoth = recipient.email && recipient.phone && payload.template === "reservation-confirmation";
    const locale = payload.locale ?? "en";

    // Resolve template with locale fallback: "template:fr" → "template"
    const localeKey = `${payload.template}:${locale}`;
    const tpl = templates[localeKey] ?? templates[payload.template];

    // Email channel
    if (recipient.email && tpl) {
      const ik = payload.idempotencyKey ? `${payload.template}:email:${recipient.email}:${payload.idempotencyKey}` : undefined;
      if (!ik || !(await checkIdempotent(prisma, payload.template, recipient.email, ik))) {
        const rendered = tpl.render(payload.data);
        const result = await sendEmail({
          to: recipient.email,
          subject: tpl.subject,
          react: rendered as ReturnType<typeof import("@react-email/components").render>,
        });
        await logSend(prisma, { venueId: payload.venueId, channel: "email", template: payload.template, recipient: recipient.email, ok: result.ok, providerId: result.providerId, error: result.error, ik, data: payload.data });
        if (result.ok) sent++; else failed++;
      }
    }

    // SMS channel — for PIN delivery (sendBoth) or phone-only recipient
    if (recipient.phone && (sendBoth || !recipient.email)) {
      const smsFn = smsTemplateFns[payload.template];
      if (smsFn) {
        const ik = payload.idempotencyKey ? `${payload.template}:sms:${recipient.phone}:${payload.idempotencyKey}` : undefined;
        if (!ik || !(await checkIdempotent(prisma, payload.template, recipient.phone, ik))) {
          const body = smsFn(payload.data);
          const result = await sendSms({ to: recipient.phone, body }, payload.venueId);
          await logSend(prisma, { venueId: payload.venueId, channel: "sms", template: payload.template, recipient: recipient.phone, ok: result.ok, providerId: result.providerId, error: result.error, ik, data: payload.data });
          if (result.ok) sent++; else failed++;
        }
      }
    }
  }

  return { sent, failed };
}

/**
 * Push dispatch: queries active subscriptions for the venue, checks per-user
 * per-event preferences, and sends push notifications. Dead subscriptions
 * (410 Gone) are automatically marked expired.
 */
export async function dispatchPush(
  prisma: PrismaClient,
  payload: PushDispatchPayload,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { venueId: payload.venueId, expired: false },
  });

  for (const sub of subscriptions) {
    const pref = await prisma.notificationPreference.findFirst({
      where: {
        venueId: payload.venueId,
        userId: sub.userId,
        eventType: payload.eventType,
        channel: "push",
      },
    });
    if (pref && !pref.enabled) continue;

    const ik = payload.idempotencyKey
      ? `push:${payload.eventType}:${sub.endpoint}:${payload.idempotencyKey}`
      : undefined;
    if (ik && (await checkIdempotent(prisma, payload.eventType, sub.endpoint, ik))) continue;

    const result = await sendPush({
      subscription: {
        endpoint: sub.endpoint,
        keys: sub.keys as unknown as { p256dh: string; auth: string },
      },
      payload: {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction,
      },
    });

    if (result.ok) {
      sent++;
    } else {
      failed++;
      if (result.error === "GONE") {
        await expireSubscription(prisma, sub.endpoint);
      }
    }

    await logSend(prisma, {
      venueId: payload.venueId,
      channel: "push",
      template: payload.eventType,
      recipient: sub.endpoint,
      ok: result.ok,
      error: result.error,
      ik,
      data: { title: payload.title, body: payload.body, url: payload.url },
    });
  }

  return { sent, failed };
}
