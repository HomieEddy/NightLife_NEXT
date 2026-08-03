import pino from "pino";

/** Fields whose values contain PII, secrets, or auth material. */
const REDACT_PATHS = [
  "email",
  "phone",
  "authorization",
  "cookie",
  "pin",
  "token",
  "secret",
  "password",
  "*.email",
  "*.phone",
  "*.pin",
  "*.token",
  "*.secret",
  "*.password",
  "headers.authorization",
  "headers.cookie",
  "headers.*authorization",
  "headers.*cookie",
  "endpoint",
];

const instance = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

type LogMeta = Record<string, unknown>;

/** Structured JSON logger — pino under the hood. Call signature kept stable so existing importers don't churn. */
export const logger = {
  info(msg: string, meta?: LogMeta) {
    instance.info(meta ?? {}, msg);
  },
  warn(msg: string, meta?: LogMeta) {
    instance.warn(meta ?? {}, msg);
  },
  error(msg: string, meta?: LogMeta) {
    instance.error(meta ?? {}, msg);
  },
};
