import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NightLifeNext",
    short_name: "NightLifeNext",
    description:
      "QR ordering, table service, and live operations for nightclubs and lounges.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1410",
    theme_color: "#1a1410",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
