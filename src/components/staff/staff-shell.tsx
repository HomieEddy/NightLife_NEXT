"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { AuthBanner } from "@/components/shared/auth-banner";
import { type BottomNavItem } from "@/components/shared/mobile-bottom-nav";
import { RequireAuth } from "@/components/shared/require-auth";
import { BroadcastBanner } from "@/components/staff/broadcast-banner";
import { CommandPalette } from "@/components/shared/command-palette";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { staffService } from "@/features/workforce/staff-service";
import { staffKeys } from "@/features/workforce/query-keys";
import { venueService } from "@/features/venue/services";
import { venueKeys } from "@/features/venue/query-keys";
import { useAuth } from "@/context/auth-context";
import { useEntitlements } from "@/lib/use-entitlements";
import { usePermissions } from "@/features/platform/use-permissions";
import { getStaffNav } from "@/features/shared/role-capabilities";
import { isNavActive } from "@/features/shared/navigation";
import { cn } from "@/features/shared/utils";

/**
 * Staff panel shell — mobile-first, high contrast for low-light use.
 * Demo uses the seeded runner persona; live mode resolves the authenticated staff profile.
 */
export function StaffShell({ children }: { children: React.ReactNode }) {
  const nt = useTranslations("shared");
  const pathname = usePathname();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { hasFeature } = useEntitlements();
  const { permissions } = usePermissions();

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: venue } = useQuery({
    queryKey: venueKeys.single(venueId),
    queryFn: () => venueService.getVenue(),
    enabled: !!venueId,
  });

  const venueName = venue?.name ?? null;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setPaletteOpen(true);
    }
    if (e.key === "Escape") { setPaletteOpen(false); setMoreOpen(false); }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const allNavItems = getStaffNav(me?.role ?? "runner", permissions).filter(
    (item) => !item.feature || hasFeature(item.feature),
  );
  const primaryItems: BottomNavItem[] = allNavItems.slice(0, 4);
  const moreItems = allNavItems.slice(4);

  return (
    <RequireAuth>
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col border-x border-border/40">
      <div className="sticky top-0 z-30">
        <BroadcastBanner />
        <header className="border-b bg-background/90 backdrop-blur-lg">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                  {me?.avatarInitials ?? "…"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold">{me?.name ?? nt("actions.loading")}</p>
                <p className="truncate text-[11px] text-muted-foreground">{venueName ?? "…"} · {nt("nav.staffPanel")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {me && <RoleBadge role={me.role} clickable />}
              <AuthBanner />
              <ThemeToggle />
              <LocaleToggle />
            </div>
          </div>
        </header>
      </div>
      <main className="flex-1 pb-20">{children}</main>
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg",
          "pb-[env(safe-area-inset-bottom)]",
          "mx-auto max-w-2xl",
        )}
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {primaryItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" />
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {item.badgeCount > 9 ? "9+" : item.badgeCount}
                    </span>
                  )}
                </span>
                {nt((item.labelKey ?? item.label) as Parameters<typeof nt>[0])}
                {active && (
                  <span className="absolute inset-x-1/4 top-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
          {moreItems.length > 0 && (
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label={nt("nav.more")}
                  className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Menu className="size-5" />
                  {nt("nav.more")}
                  {moreItems.some((item) =>
                    item.href === pathname || pathname.startsWith(item.href + "/"),
                  ) && (
                    <span className="absolute inset-x-1/4 top-0 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="mx-auto max-w-lg overflow-y-auto rounded-t-xl" style={{ maxHeight: "75dvh" }}>
                <div className="space-y-1 pt-4">
                  <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {nt("nav.more")}
                  </p>
                  {moreItems.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <item.icon className="size-5" />
                        <span>{nt((item.labelKey ?? item.label) as Parameters<typeof nt>[0])}</span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
    </RequireAuth>
  );
}
