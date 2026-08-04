/**
 * Phase 5: Web Push transport — PUSH_DRIVER=log (default) logs to stdout;
 * staging/prod set webpush. Missing VAPID_* under webpush fails config at boot.
 * Dead subscriptions self-clean on 410 Gone from push service.
 */
import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";
import { logger } from "@/features/shared/logger";

export const PUSH_DRIVER = process.env.PUSH_DRIVER === "webpush" ? "webpush" : "log";

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@nightlife.app";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required (generate: npx web-push generate-vapid-keys)");
  }
  return { publicKey, privateKey, subject };
}

interface PushSendInput {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  payload: { title: string; body?: string; url?: string; tag?: string; requireInteraction?: boolean };
}

export async function sendPush(input: PushSendInput): Promise<{ ok: boolean; error?: string }> {
  if (PUSH_DRIVER === "log") {
    // endpoint identifies the device — structured field, redacted.
    logger.info("[push:log]", { endpoint: input.subscription.endpoint, title: input.payload.title });
    return { ok: true };
  }

  try {
    const vapid = getVapidKeys();
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    // Web Push payloads cap at 4096 bytes — truncate so a long body can't
    // 413 (counted as a failure with no retry).
    const payloadText = JSON.stringify(input.payload);
    const payload =
      new TextEncoder().encode(payloadText).length <= 4096
        ? payloadText
        : JSON.stringify({ ...input.payload, body: (input.payload.body ?? "").slice(0, 400) });

    const result = await webpush.sendNotification(
      {
        endpoint: input.subscription.endpoint,
        keys: input.subscription.keys as webpush.PushSubscription["keys"],
      },
      payload,
    );
    return { ok: result.statusCode >= 200 && result.statusCode < 300 };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410) return { ok: false, error: "GONE" };
    return { ok: false, error: err instanceof Error ? err.message : "Push failed" };
  }
}

/** Clean up a single dead subscription (410 Gone from push service). */
export async function expireSubscription(prisma: PrismaClient, endpoint: string): Promise<void> {
  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data: { expired: true },
  });
}
