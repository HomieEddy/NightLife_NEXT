/**
 * Thin Twilio SMS transport — SMS_DRIVER=log (default) logs to stdout;
 * staging/prod set twilio. Missing TWILIO_* vars under twilio fails at boot.
 */
import { Twilio } from "twilio";
import { logger } from "@/lib/logger";

const SMS_DRIVER = process.env.SMS_DRIVER === "twilio" ? "twilio" : "log";

function getTwilio(): Twilio {
  if (SMS_DRIVER !== "twilio") throw new Error("Twilio is not configured — set SMS_DRIVER=twilio and TWILIO_* vars");
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when SMS_DRIVER=twilio");
  return new Twilio(sid, token);
}

interface SmsSendInput {
  to: string; // E.164
  body: string;
}

/** Cost guard — reset per venue restart. Earn a Redis counter when scale demands it. */
const dailyCounts = new Map<string, number>();
const DAILY_SMS_CAP = 50; // per-venue, per server restart — ponytail: global lock, per-venue Redis counter if throughput matters

export function canSendSms(venueId: string): boolean {
  return (dailyCounts.get(venueId) ?? 0) < DAILY_SMS_CAP;
}

export async function sendSms(input: SmsSendInput, venueId: string): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  if (!canSendSms(venueId)) return { ok: false, error: "Daily SMS cap reached" };

  if (SMS_DRIVER === "log") {
    logger.info(`[sms:log] To: ${input.to} | ${input.body.slice(0, 80)}`);
    dailyCounts.set(venueId, (dailyCounts.get(venueId) ?? 0) + 1);
    return { ok: true, providerId: "log" };
  }

  try {
    const twilio = getTwilio();
    const from = process.env.TWILIO_FROM;
    if (!from) throw new Error("TWILIO_FROM is required when SMS_DRIVER=twilio");
    const msg = await twilio.messages.create({ body: input.body, to: input.to, from });
    dailyCounts.set(venueId, (dailyCounts.get(venueId) ?? 0) + 1);
    return { ok: true, providerId: msg.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}

export { SMS_DRIVER };
