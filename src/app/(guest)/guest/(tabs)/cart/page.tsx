"use client";

"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { CartContents } from "@/components/guest/cart-contents";
import { ClosureGate } from "@/components/guest/closure-gate";

export default function GuestCartPage() {
  const t = useTranslations("guest.cart");
  return (
    <ClosureGate>
      <div className="space-y-4 p-4 animate-fade-in">
        <PageHeader title={t("title")} description={t("description")} />
        <CartContents />
      </div>
    </ClosureGate>
  );
}
