"use client";

import { useQuery } from "@tanstack/react-query";
import { FeatureGate } from "@/components/shared/feature-gate";
import { ChatPanel } from "@/components/shared/chat-panel";
import { staffService } from "@/features/workforce/staff-service";
import { staffKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { getPinnedChatChannel } from "@/features/shared/role-capabilities";

export default function StaffChatPage() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const pinned = me ? getPinnedChatChannel(me.role) ?? undefined : undefined;

  return (
    <div className="animate-fade-in">
      <FeatureGate feature="chat">
        <ChatPanel currentUserId={me?.id ?? ""} pinnedChannel={pinned} />
      </FeatureGate>
    </div>
  );
}
