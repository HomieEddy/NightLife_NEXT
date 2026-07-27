/**
 * Notification dispatch core — resolves channels per recipient, calls each
 * transport, records one NotificationLog row per attempt. The log is both the
 * audit trail and the idempotency check (same (channel, template, recipient,
 * idempotencyKey) only sends once).
 *
 * Plan 26: recipients with a phone and no email get SMS; with both get both
 * for PIN delivery (the PIN is the one message worth double-delivery);
 * email-only otherwise.
 */
import type { PrismaClient } from "@prisma/client";
import { type DispatchPayload } from "./types";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
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

    // Email channel
    if (recipient.email && hasTemplate) {
      const ik = payload.idempotencyKey ? `${payload.template}:email:${recipient.email}:${payload.idempotencyKey}` : undefined;
      if (!ik || !(await checkIdempotent(prisma, payload.template, recipient.email, ik))) {
        const rendered = hasTemplate.render(payload.data);
        const result = await sendEmail({
          to: recipient.email,
          subject: hasTemplate.subject,
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
