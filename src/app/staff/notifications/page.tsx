"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationPreferencesCard } from "@/components/shared/notification-preferences-card";

export default function StaffNotificationsPage() {
  const t = useTranslations("staff.notifications");
  return (
    <div className="animate-fade-in max-w-2xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <NotificationPreferencesCard />
    </div>
  );
}
