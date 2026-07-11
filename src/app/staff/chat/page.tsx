"use client";

import { ChatPanel } from "@/components/shared/chat-panel";
import { CURRENT_STAFF_ID } from "@/lib/mock-data/staff";

export default function StaffChatPage() {
  return <ChatPanel currentUserId={CURRENT_STAFF_ID} />;
}
