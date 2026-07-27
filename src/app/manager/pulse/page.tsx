"use client";

import { PageHeader } from "@/components/shared/page-header";
import { PulseTab } from "@/components/manager/pulse-tab";
import { useAttention } from "@/lib/attention-provider";

export default function ManagerPulsePage() {
  const { items, lastCallActive, sendBroadcast, toggleLastCall } = useAttention();
  const managerName = "Manager";

  return (
    <div className="space-y-6">
      <PageHeader title="Pulse" description="Live attention feed — overdue orders, open help, capacity and incidents" />
      <PulseTab
        items={items}
        lastCallActive={lastCallActive}
        onSendBroadcast={(m) => sendBroadcast(m, managerName)}
        onToggleLastCall={() => toggleLastCall(managerName)}
      />
    </div>
  );
}
