import type { NextConfig } from "next";
import { parseAppMode } from "./src/lib/app-mode";

const appMode = parseAppMode(process.env.NEXT_PUBLIC_APP_MODE);

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    resolveAlias: appMode === "live" ? {
      "@/components/shared/demo-controls": "./src/components/shared/demo-controls.live.tsx",
      "@/components/shared/app-mode-banner": "./src/components/shared/app-mode-banner.live.tsx",
    } : {},
  },
};

export default nextConfig;
