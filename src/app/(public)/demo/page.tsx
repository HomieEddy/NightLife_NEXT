import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DemoTourPage } from "@/components/shared/demo-tour-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demo.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default DemoTourPage;
