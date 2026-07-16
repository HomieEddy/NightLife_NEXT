"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { ChatPanel } from "@/components/shared/chat-panel";
import { useAuth } from "@/context/auth-context";

export default function ManagerChatPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <FeatureGate feature="chat">
      <ChatPanel currentUserId={user.id} />
    </FeatureGate>
  );
}
