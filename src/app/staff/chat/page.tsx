"use client";

import { ChatPanel } from "@/components/shared/chat-panel";
import { staffService } from "@/lib/services/staff-service";
import { useEffect, useState } from "react";

export default function StaffChatPage() {
  const [userId, setUserId] = useState("");

  useEffect(() => {
    staffService.getCurrentStaff().then((staff) => setUserId(staff?.id ?? ""));
  }, []);

  return <ChatPanel currentUserId={userId} />;
}
