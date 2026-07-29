"use client";

import { FeatureGate } from "@/components/shared/feature-gate";
import { ChatPanel } from "@/components/shared/chat-panel";
import { staffService } from "@/features/workforce/staff-service";
import { getPinnedChatChannel } from "@/features/shared/role-capabilities";
import { useEffect, useState } from "react";
import type { StaffMember } from "@/lib/types";

export default function StaffChatPage() {
  const [me, setMe] = useState<StaffMember | null>(null);

  useEffect(() => {
    staffService.getCurrentStaff().then(setMe);
  }, []);

  const pinned = me ? getPinnedChatChannel(me.role) ?? undefined : undefined;

  return (
    <div className="animate-fade-in">
      <FeatureGate feature="chat">
        <ChatPanel currentUserId={me?.id ?? ""} pinnedChannel={pinned} />
      </FeatureGate>
    </div>
  );
}
