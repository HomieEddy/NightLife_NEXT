import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { buildDirectoryForMode, parseAppMode } from "./src/features/shared/app-mode";

const appMode = parseAppMode(process.env.NEXT_PUBLIC_APP_MODE);
const hasSentry = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
);

const demoResourceAliases = {
  "@/features/shared/db": "./src/features/shared/demo-resource-stub.ts",
  "@/server/auth": "./src/features/shared/demo-resource-stub.ts",
  "@/features/platform/auth": "./src/features/shared/demo-resource-stub.ts",
};

const mockServiceFiles = [
  "admin-service",
  "analytics-service",
  "auth-service",
  "billing-service",
  "events-service",
  "guests-service",
  "menu-service",
  "orders-service",
  "promotions-service",
  "pulse-service",
  "report-service",
  "reservation-service",
  "show-queue-service",
  "staff-service",
  "venue-service",
];

const liveMockAliases = Object.fromEntries(
  mockServiceFiles.map((file) => [
    `@/lib/mock-services/${file}`,
    "./src/features/shared/live-mock-stub.ts",
  ]),
);

const nextConfig: NextConfig = {
  /* config options here */
  distDir: process.env.VERCEL ? ".next" : buildDirectoryForMode(appMode),
  reactCompiler: true,
  devIndicators: false,

  // ── Security headers (plan 31) ──────────────────────────────────────
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    // CSP frame-ancestors: deny everywhere except the embeddable shells
    // (/r/[venueSlug] and /e/[venueSlug]) which are designed to be iframed
    // by venue websites. See plan 13 and plan 31.
    const cspBase = "frame-ancestors 'none';";
    const cspEmbed = "frame-ancestors *;";
    // Report-only script CSP — enforced CSP with Next inline runtime chunks
    // is its own project (plan 31 defers it). Report violations so we can
    // measure the gap without breaking the app. report-to replaces the
    // deprecated report-uri (the Report-To header below defines the group).
    const cspReportOnly = [
      "default-src 'self';",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
      "style-src 'self' 'unsafe-inline';",
      "img-src 'self' data: blob: https:;",
      "font-src 'self';",
      "connect-src 'self';",
      "report-to csp-endpoint;",
    ].join(" ");

    const reportToHeader = JSON.stringify({
      group: "csp-endpoint",
      max_age: 60 * 60 * 24,
      endpoints: [{ url: "/api/csp-report" }],
    });

    return [
      // ── All routes: baseline security headers ───────────────────────
      // The negative match excludes /r/ and /e/ prefixes specifically —
      // the old `((?!r|e).*)` also stripped headers from any future
      // top-level route starting with "r" or "e".
      {
        source: "/((?!r/|e/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: cspBase },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          { key: "Report-To", value: reportToHeader },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      // ── Embeddable shells: allow framing from any origin ─────────────
      {
        source: "/r/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: cspEmbed },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          { key: "Report-To", value: reportToHeader },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        source: "/e/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: cspEmbed },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          { key: "Report-To", value: reportToHeader },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: appMode === "live"
      ? {
          "@vercel/analytics/react": "./src/features/shared/vercel-analytics-stub.tsx",
          "@/components/shared/demo-controls": "./src/components/shared/demo-controls.live.tsx",
          "@/components/shared/app-mode-banner": "./src/components/shared/app-mode-banner.live.tsx",
          "@/components/shared/demo-links": "./src/components/shared/demo-links.live.tsx",
          "@/components/shared/demo-tour-page": "./src/components/shared/demo-tour-page.live.tsx",
          "@/components/shared/admin-surface": "./src/components/shared/admin-surface.live.tsx",
          "@/components/shared/plan10-surface": "./src/components/shared/plan10-surface.live.tsx",
          ...liveMockAliases,
        }
      : demoResourceAliases,
  },
};

// Wrap with next-intl plugin (reads ./i18n/request.ts from src/ or root).
const withNextIntl = createNextIntlPlugin();
let finalConfig: NextConfig = withNextIntl(nextConfig);

// Conditionally wrap with Sentry — no-op when SENTRY_DSN is absent.
// Dynamic require avoids loading the Sentry SDK into the demo bundle at all.
if (hasSentry) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require("@sentry/nextjs") as {
    withSentryConfig: (c: NextConfig) => NextConfig;
  };
  finalConfig = withSentryConfig(finalConfig);
}

export default finalConfig;
