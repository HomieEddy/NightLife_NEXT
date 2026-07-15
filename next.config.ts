import type { NextConfig } from "next";
import { buildDirectoryForMode, parseAppMode } from "./src/lib/app-mode";

const appMode = parseAppMode(process.env.NEXT_PUBLIC_APP_MODE);

const demoResourceAliases = {
  "@/server/auth": "./src/server/demo-resource-stub.ts",
  "@/server/db": "./src/server/demo-resource-stub.ts",
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
    "./src/lib/live-mock-stub.ts",
  ]),
);

const nextConfig: NextConfig = {
  /* config options here */
  distDir: buildDirectoryForMode(appMode),
  reactCompiler: true,
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
