"use client";

import { ChatPanel } from "@/components/shared/chat-panel";
import { useAuth } from "@/context/auth-context";
import { isDemoMode } from "@/lib/app-mode";
import { CURRENT_STAFF_ID } from "@/lib/mock-data/staff";

export default function StaffChatPage() {
  const { user } = useAuth();
  const userId = isDemoMode() ? CURRENT_STAFF_ID : user?.id ?? "";
  return <ChatPanel currentUserId={userId} />;
}
