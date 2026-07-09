"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { mockStaffService } from "@/lib/mock-services/staff-service";
import type { StaffMember } from "@/lib/types";
import { Home, LifeBuoy, MessageSquare, Receipt, UserCheck } from "lucide-react";

/**
 * Staff panel shell — mobile-first, high contrast for low-light use.
 * TODO(backend): the "current staff" persona comes from real auth.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<StaffMember | null>(null);

  useEffect(() => {
    mockStaffService.getCurrentStaff().then(setMe);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col border-x border-border/40">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {me?.avatarInitials ?? "…"}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{me?.name ?? "Loading…"}</p>
              <p className="text-[11px] text-muted-foreground">LUXE Noir · Staff panel</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {me && <RoleBadge role={me.role} />}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-20">{children}</main>
      <MobileBottomNav
        className="mx-auto max-w-2xl"
        items={[
          { href: "/staff", label: "Home", icon: Home },
          { href: "/staff/orders", label: "Orders", icon: Receipt },
          { href: "/staff/approvals", label: "Approvals", icon: UserCheck },
          { href: "/staff/help", label: "Help", icon: LifeBuoy },
          { href: "/staff/chat", label: "Chat", icon: MessageSquare },
        ]}
      />
    </div>
  );
}
