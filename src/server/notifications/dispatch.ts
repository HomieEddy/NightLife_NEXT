/**
 * Notification dispatch core — resolves channels per recipient, calls each
 * transport, records one NotificationLog row per attempt. The log is both the
 * audit trail and the idempotency check (same (channel, template, recipient,
 * idempotencyKey) only sends once).
 */
import type { PrismaClient } from "@prisma/client";
import { type DispatchPayload } from "./types";
import { sendEmail } from "./email";

type RenderFn = (props: Record<string, unknown>) => ReturnType<typeof import("@react-email/components").render>;

const templates: Record<string, { subject: string; render: RenderFn }> = {};

export function registerTemplate(name: string, subject: string, render: RenderFn) {
  templates[name] = { subject, render };
}

export async function dispatch(
  prisma: PrismaClient,
  payload: DispatchPayload,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const template = templates[payload.template];
  if (!template) {
    console.warn(`[notifications] Unknown template: ${payload.template}`);
    return { sent, failed };
  }

  for (const recipient of payload.recipients) {
    if (recipient.email) {
      const idempotencyKey = payload.idempotencyKey
        ? `${payload.template}:${recipient.email}:${payload.idempotencyKey}`
        : undefined;

      if (idempotencyKey) {
        const existing = await prisma.notificationLog.findFirst({
          where: { template: payload.template, recipient: recipient.email, status: "sent" },
        });
        if (existing && existing.meta && (existing.meta as Record<string, unknown>).ik === idempotencyKey) {
          continue; // already sent — idempotent
        }
      }

      const rendered = template.render(payload.data);
      const result = await sendEmail({
        to: recipient.email,
        subject: template.subject,
        react: rendered as ReturnType<typeof import("@react-email/components").render>,
      });

      await prisma.notificationLog.create({
        data: {
          venueId: payload.venueId,
          channel: "email",
          template: payload.template,
          recipient: recipient.email,
          status: result.ok ? "sent" : "failed",
          providerId: result.providerId,
          error: result.error,
          meta: { ik: idempotencyKey, ...payload.data },
        },
      });

      if (result.ok) sent++;
      else failed++;
    }
  }

  return { sent, failed };
}
