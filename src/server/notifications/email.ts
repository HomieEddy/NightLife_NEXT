/**
 * Thin Resend transport — EMAIL_DRIVER=log (default) logs to stdout with no
 * API key needed; staging/prod set resend. Missing RESEND_API_KEY under resend
 * fails configuration at boot.
 */
import { Resend } from "resend";
import type { render } from "@react-email/components";
import { logger } from "@/lib/logger";

const EMAIL_DRIVER = process.env.EMAIL_DRIVER === "resend" ? "resend" : "log";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "NightLife <noreply@nightlife.app>";

function getResend(): Resend {
  if (EMAIL_DRIVER !== "resend") throw new Error("Resend is not configured — set EMAIL_DRIVER=resend and RESEND_API_KEY");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required when EMAIL_DRIVER=resend");
  return new Resend(apiKey);
}

interface EmailSendInput {
  to: string;
  subject: string;
  react: ReturnType<typeof render>;
}

export async function sendEmail(input: EmailSendInput): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  if (EMAIL_DRIVER === "log") {
    logger.info(`[email:log] To: ${input.to} | Subject: ${input.subject}`);
    return { ok: true, providerId: "log" };
  }
  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      react: input.react as never,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, providerId: result.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

export { EMAIL_DRIVER, EMAIL_FROM };
