/**
 * Next.js instrumentation — runs once at server boot (Next 15+).
 *
 * @sentry/nextjs v10 requires this file to load the server and edge configs;
 * without it their `register()` never fires and server-side errors go
 * uncaptured. Guarded on SENTRY_DSN so demo builds and DSN-less local dev
 * never initialize the SDK.
 */
export async function register() {
  if (process.env.SENTRY_DSN) {
    await import("../sentry.server.config");
    await import("../sentry.edge.config");
  }
}
