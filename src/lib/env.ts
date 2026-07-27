import { z } from "zod";
import { assertLiveMode } from "./app-mode";

const liveSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  QR_TOKEN_SECRET: z.string().min(16),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_DRIVER: z.enum(["log", "resend"]).default("log"),
  CRON_SECRET: z.string().min(16).optional(),
});

export type LiveEnv = z.infer<typeof liveSchema>;

let _validated: LiveEnv | null = null;

/** @internal — only for test-pglite to reset after changing process.env */
export function _resetEnvCache() {
  _validated = null;
}

/**
 * Returns validated env vars. Only callable in live mode — throws at boot
 * if required vars are missing so misconfiguration fails loudly.
 */
export function getLiveEnv(): LiveEnv {
  assertLiveMode();
  if (_validated) return _validated;
  _validated = liveSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    QR_TOKEN_SECRET: process.env.QR_TOKEN_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_DRIVER: process.env.EMAIL_DRIVER,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  return _validated;
}
