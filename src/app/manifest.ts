import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/app-mode";

export default function manifest(): MetadataRoute.Manifest {
  const demo = isDemoMode();
  return {
    name: demo ? "NightLife Demo" : "NightLife",
    short_name: demo ? "NL Demo" : "NightLife",
    description:
      "QR ordering, table service, and live operations for nightclubs and lounges.",
    start_url: demo ? "/demo" : "/",
    display: "standalone",
    background_color: "#1a1410",
    theme_color: "#1a1410",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
