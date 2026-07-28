"use client";

import { useEffect, useState, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AuthBanner } from "@/components/shared/auth-banner";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { RequireAuth } from "@/components/shared/require-auth";
import { BroadcastBanner } from "@/components/staff/broadcast-banner";
import { CommandPalette } from "@/components/shared/command-palette";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { useEntitlements } from "@/lib/use-entitlements";
import { getStaffNav } from "@/features/shared/role-capabilities";
import type { StaffMember } from "@/lib/types";

/**
 * Staff panel shell — mobile-first, high contrast for low-light use.
 * Demo uses the seeded runner persona; live mode resolves the authenticated staff profile.
 */
export function StaffShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { hasFeature } = useEntitlements();

  useEffect(() => {
    staffService.getCurrentStaff().then(setMe);
    venueService.getVenue().then((v) => setVenueName(v.name));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setPaletteOpen(true);
    }
    if (e.key === "Escape") setPaletteOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <RequireAuth>
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col border-x border-border/40">
      <div className="sticky top-0 z-30">
        <BroadcastBanner />
        <header className="border-b bg-background/90 backdrop-blur-lg">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                  {me?.avatarInitials ?? "…"}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{me?.name ?? "Loading…"}</p>
                <p className="text-[11px] text-muted-foreground">{venueName ?? "…"} · Staff panel</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {me && <RoleBadge role={me.role} clickable />}
              <AuthBanner />
              <ThemeToggle />
            </div>
          </div>
        </header>
      </div>
      <main className="flex-1 pb-20">{children}</main>
      <MobileBottomNav
        className="mx-auto max-w-2xl"
        items={getStaffNav(me?.role ?? "runner").filter(
          (item) => !item.feature || hasFeature(item.feature),
        )}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
    </RequireAuth>
  );
}
