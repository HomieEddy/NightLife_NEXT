import type { MetadataRoute } from "next";
import { isDemoMode } from "@/features/shared/app-mode";
import { DEMO_APP_URL } from "@/features/shared/app-origins";

/**
 * Demo build: whitelist the public surfaces (tour, legal pages) and keep
 * crawlers out of product UI. Live build: neutral until the live landing
 * gets its own SEO pass.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isDemoMode()) {
    return { rules: { userAgent: "*", allow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: ["/demo", "/privacy", "/terms"],
      disallow: "/",
    },
    sitemap: `${DEMO_APP_URL}/sitemap.xml`,
  };
}
