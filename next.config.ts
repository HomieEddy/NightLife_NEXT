import type { NextConfig } from "next";
import { buildDirectoryForMode, parseAppMode } from "./src/features/shared/app-mode";

const appMode = parseAppMode(process.env.NEXT_PUBLIC_APP_MODE);

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
  turbopack: {
    resolveAlias: appMode === "live"
      ? {
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

export default nextConfig;
