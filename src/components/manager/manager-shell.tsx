"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  Map,
  Menu,
  Receipt,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/shared/brand-logo";
import { RequireAuth } from "@/components/shared/require-auth";
import { isManagerOnboarded } from "@/lib/onboarding";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AuthBanner } from "@/components/shared/auth-banner";
import { CommandPalette } from "@/components/shared/command-palette";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PulseTab } from "@/components/manager/pulse-tab";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/app-mode";
import { venueService } from "@/lib/services/venue-service";
import { ordersService } from "@/lib/services/orders-service";
import { guestsService } from "@/lib/services/guests-service";
import { doorService } from "@/lib/services/door-service";
import { waitlistService } from "@/lib/services/waitlist-service";
import { incidentService } from "@/lib/services/incident-service";
import { pulseService } from "@/lib/services/pulse-service";
import { computeAttentionItems } from "@/lib/pulse";
import { useLiveEvents } from "@/lib/use-live-events";
import { useEntitlements } from "@/lib/use-entitlements";
import {
  MANAGER_NAV_GROUPS,
  MANAGER_FOOTER_ITEMS,
  DEMO_FOOTER_ITEMS,
  isNavActive,
  isGroupCollapsed,
  setGroupCollapsed,
  type NavGroup,
} from "@/lib/navigation";
import type { AttentionItem } from "@/lib/types";

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [venueName, setVenueName] = useState<string | null>(null);
  const { hasFeature } = useEntitlements();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [attentionSheetOpen, setAttentionSheetOpen] = useState(false);
  const [lastCallActive, setLastCallActive] = useState(false);
  const [managerName, setManagerName] = useState("Manager");

  // Collapsed group state — persisted in localStorage, hydrated in a useEffect
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const state: Record<string, boolean> = {};
    for (const g of MANAGER_NAV_GROUPS) {
      state[g.label] = isGroupCollapsed(g.label);
    }
    setCollapsed(state);
  }, []);
  const toggleCollapsed = useCallback((label: string) => {
    setCollapsed((prev) => {
      const next = !prev[label];
      setGroupCollapsed(label, next);
      return { ...prev, [label]: next };
    });
  }, []);

  // Filter groups by entitlements — a group with zero visible items hides entirely.
  const groups: NavGroup[] = MANAGER_NAV_GROUPS
    .map((g) => ({
      label: g.label,
      items: g.items.filter((item) => !item.feature || hasFeature(item.feature)),
    }))
    .filter((g) => g.items.length > 0);

  const footerItems = isDemoMode() ? DEMO_FOOTER_ITEMS : MANAGER_FOOTER_ITEMS;

  // Attention items — fetched app-wide, consumed by the header bell + Pulse sheet
  const refreshAttention = useCallback(async () => {
    try {
      const [liveOrders, helpRequests, tables, zones, venue, lastCall, sessions, adjustments, occupancy, waitlistEntries, openIncidents] = await Promise.all([
        ordersService.listOrders(),
        guestsService.listHelpRequests(),
        venueService.listTables(),
        venueService.listZones(),
        venueService.getVenue(),
        pulseService.getLastCallState(),
        guestsService.listSessions("approved"),
        ordersService.listAllAdjustments(),
        doorService.getOccupancy(),
        waitlistService.listEntries("waiting"),
        incidentService.listIncidents({ status: "open" }),
      ]);
      const items = computeAttentionItems(
        liveOrders, helpRequests, tables, zones,
        venue.slaThresholds, lastCall.active, venue.lastCallAutoFlagTables,
        sessions, adjustments, venue.minimumSpendWarningRatio,
        {
          occupancy: occupancy.current, legalCapacity: occupancy.legalCapacity,
          occupancyWarnRatio: venue.occupancyWarnRatio, waitlistEntries, openIncidents,
        },
      );
      setAttentionItems(items);
      setAttentionCount(items.length);
      setLastCallActive(lastCall.active);
      setManagerName("Manager");
    } catch { /* ignore */ }
  }, []);

  const attentionRef = useRef(refreshAttention);
  attentionRef.current = refreshAttention;

  useEffect(() => { refreshAttention(); }, [refreshAttention]);
  useLiveEvents({
    scope: "manager",
    onEvent: () => attentionRef.current(),
    fallbackMs: 8000,
    fallbackRefresh: () => attentionRef.current(),
  });

  // ⌘K / Ctrl+K → command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Track which critical items have already been toasted to prevent spam on refresh
  const toastedIds = useRef<Set<string>>(new Set());

  // Critical items toast — only fire for new items, not on every refresh
  useEffect(() => {
    const critical = attentionItems.filter((i) => i.severity === "critical" && i.type !== "clock-out-missing");
    for (const item of critical.slice(0, 3)) {
      if (toastedIds.current.has(item.id)) continue;
      toastedIds.current.add(item.id);
      toast.warning(item.message, { id: item.id, duration: 8000 });
    }
    // Prune stale ids that are no longer in the attention list
    const currentIds = new Set(attentionItems.map((i) => i.id));
    for (const id of toastedIds.current) {
      if (!currentIds.has(id)) toastedIds.current.delete(id);
    }
  }, [attentionItems]);

  // Broadcast and last call for the attention sheet
  async function sendBroadcast(message: string) {
    await pulseService.sendBroadcast(message, managerName);
    await refreshAttention();
  }
  async function toggleLastCall() {
    if (lastCallActive) await pulseService.endLastCall();
    else await pulseService.startLastCall(managerName);
    await refreshAttention();
  }

  useEffect(() => {
    venueService.getVenue().then((v) => setVenueName(v.name));
  }, []);
  const onOnboarding = pathname.startsWith("/manager/onboarding");

  useEffect(() => {
    if (isDemoMode() && !onOnboarding && !isManagerOnboarded()) router.replace("/manager/onboarding");
  }, [onOnboarding, pathname, router]);

  if (onOnboarding) {
    return (
      <RequireAuth>
        <div className="min-h-dvh">
          <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
              <BrandLogo href="/manager/onboarding" />
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</main>
        </div>
      </RequireAuth>
    );
  }

  function navItemLink(item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }, extraClasses?: string) {
    const active = isNavActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
          extraClasses,
        )}
      >
        <item.icon className="size-4" />
        {item.label}
      </Link>
    );
  }

  function groupedNav() {
    return (
      <>
        {groups.map((group) => {
          const collapsed_ = collapsed[group.label] ?? false;
          return (
            <div key={group.label} className="mb-1">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                onClick={() => toggleCollapsed(group.label)}
              >
                <ChevronDown className={cn("size-3 transition-transform", collapsed_ && "-rotate-90")} />
                {group.label}
              </button>
              {!collapsed_ && (
                <div className="space-y-0.5">
                  {group.items.map((item) => navItemLink(item))}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  function footerBlock() {
    return (
      <div className="border-t p-3">
        {footerItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        ))}
        <div className="mt-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground text-xs">{venueName ?? "…"}</p>
          <AuthBanner className="mt-0.5" />
        </div>
      </div>
    );
  }

  // Mobile bottom nav primaries
  const mobilePrimaries = [
    { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manager/orders", label: "Orders", icon: Receipt },
    { href: "/manager/floor-map", label: "Floor map", icon: Map },
  ];

  return (
    <RequireAuth>
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex print:md:hidden">
        <div className="flex h-14 items-center gap-1 border-b px-3">
          <BrandLogo href="/manager" />
          <div className="flex-1" />
          <button
            onClick={() => setPaletteOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="size-4" />
          </button>
          <Sheet open={attentionSheetOpen} onOpenChange={setAttentionSheetOpen}>
            <SheetTrigger asChild>
              <button className="relative rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="Attention feed">
                <Bell className="size-4" />
                {attentionCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                    {attentionCount > 9 ? "9+" : attentionCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-sm font-semibold mb-3">Attention feed</h2>
                <PulseTab
                  items={attentionItems}
                  lastCallActive={lastCallActive}
                  onSendBroadcast={sendBroadcast}
                  onToggleLastCall={toggleLastCall}
                />
              </div>
            </SheetContent>
          </Sheet>
          <ThemeToggle />
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {groupedNav()}
        </nav>
        {footerBlock()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg md:hidden print:hidden">
          <div className="flex h-12 items-center justify-between px-3">
            <BrandLogo href="/manager" variant="mark" />
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPaletteOpen(true)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Search"
              >
                <Search className="size-4" />
              </button>
              <Sheet open={attentionSheetOpen} onOpenChange={setAttentionSheetOpen}>
                <SheetTrigger asChild>
                  <button className="relative rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Attention">
                    <Bell className="size-4" />
                    {attentionCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                        {attentionCount > 9 ? "9+" : attentionCount}
                      </span>
                    )}
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
                  <div className="p-4">
                    <h2 className="text-sm font-semibold mb-3">Attention feed</h2>
                    <PulseTab
                      items={attentionItems}
                      lastCallActive={lastCallActive}
                      onSendBroadcast={sendBroadcast}
                      onToggleLastCall={toggleLastCall}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <RoleBadge role="manager" />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-20 sm:p-6 md:pb-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/90 backdrop-blur-lg md:hidden print:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-14">
            {mobilePrimaries.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 min-w-0 py-1 px-2 text-xs transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-5" />
                  <span className="truncate max-w-[64px]">{item.label}</span>
                </Link>
              );
            })}
            <Sheet>
              <SheetTrigger asChild>
                <button
                  aria-label="More navigation"
                  className={cn("flex flex-col items-center gap-0.5 min-w-0 py-1 px-2 text-xs text-muted-foreground transition-colors")}
                >
                  <Menu className="size-5" />
                  <span className="truncate max-w-[64px]">More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[75dvh] overflow-y-auto rounded-t-xl">
                <div className="space-y-3 pt-4">
                  {groupedNav()}
                  <hr />
                  {footerBlock()}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </div>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </RequireAuth>
  );
}
