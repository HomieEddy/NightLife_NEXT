import type { MetadataRoute } from "next";
import { isDemoMode } from "@/features/shared/app-mode";
import { DEMO_APP_URL } from "@/features/shared/app-origins";

/**
 * Demo build: the three public surfaces, canonicalized on the demo origin.
 * Live build: empty until the live landing ships its own sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isDemoMode()) return [];

  return [
    { url: `${DEMO_APP_URL}/demo`, changeFrequency: "weekly", priority: 1 },
    { url: `${DEMO_APP_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${DEMO_APP_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
