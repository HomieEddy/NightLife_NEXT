import * as Sentry from "@sentry/nextjs";
import { logger } from "@/features/shared/logger";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENV ??
      (process.env.NEXT_PUBLIC_APP_MODE === "live" ? "production" : "development"),
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip PII from error breadcrumbs and request data
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        const { authorization, cookie, ...rest } = event.request.headers;
        event.request.headers = rest;
      }
      return event;
    },
  });
  logger.info("sentry:init", {
    environment: process.env.SENTRY_ENV ?? "production",
    release: process.env.SENTRY_RELEASE,
  });
}
