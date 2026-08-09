import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DemoTourPage } from "@/components/shared/demo-tour-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demo.meta");
  return {
    title: t("title"),
    description: t("description"),
    // Canonical resolves against metadataBase (the demo origin).
    alternates: { canonical: "/demo" },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "/demo",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default DemoTourPage;
