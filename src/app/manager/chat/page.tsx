"use client";

import { ChatPanel } from "@/components/shared/chat-panel";
import { useAuth } from "@/context/auth-context";

export default function ManagerChatPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <ChatPanel currentUserId={user.id} />;
}
