import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENV ??
      (process.env.NEXT_PUBLIC_APP_MODE === "live" ? "production" : "development"),
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
