"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { ChatPanel } from "@/components/shared/chat-panel";
import { staffService } from "@/lib/services/staff-service";
import { useEffect, useState } from "react";

export default function StaffChatPage() {
  const [userId, setUserId] = useState("");

  useEffect(() => {
    staffService.getCurrentStaff().then((staff) => setUserId(staff?.id ?? ""));
  }, []);

  return (
    <FeatureGate feature="chat">
      <ChatPanel currentUserId={userId} />
    </FeatureGate>
  );
}
