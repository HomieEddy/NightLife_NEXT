import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENV ??
      (process.env.NEXT_PUBLIC_APP_MODE === "live" ? "production" : "development"),
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
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
}
