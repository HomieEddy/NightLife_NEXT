"use client";

import { PageHeader } from "@/components/shared/page-header";
import { NotificationPreferencesCard } from "@/components/shared/notification-preferences-card";

export default function StaffNotificationsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Notification preferences"
        description="Choose which events trigger push, email, or SMS alerts for your role."
      />
      <NotificationPreferencesCard />
    </div>
  );
}
