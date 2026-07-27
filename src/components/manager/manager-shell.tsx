"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  ListChecks,
  Map,
  MapPin,
  Martini,
  MessageSquare,
  PartyPopper,
  QrCode,
  Receipt,
  Settings,
  Table2,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { RequireAuth } from "@/components/shared/require-auth";
import { isManagerOnboarded } from "@/lib/onboarding";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AuthBanner } from "@/components/shared/auth-banner";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/app-mode";
import { venueService } from "@/lib/services/venue-service";
import { useEntitlements } from "@/lib/use-entitlements";
import type { FeatureKey } from "@/lib/types";

// Entries without a feature key are core and never hidden by the plan.
const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; feature?: FeatureKey }[] = [
  { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/orders", label: "Orders", icon: Receipt },
  { href: "/manager/analytics", label: "Analytics", icon: BarChart3, feature: "analytics" },
  { href: "/manager/reports", label: "Reports", icon: FileText, feature: "reports" },
  { href: "/manager/menu", label: "Menu", icon: Martini },
  { href: "/manager/inventory", label: "Inventory", icon: Boxes, feature: "inventory" },
  { href: "/manager/floor-map", label: "Floor map", icon: Map, feature: "floor-map" },
  { href: "/manager/zones", label: "Zones", icon: MapPin },
  { href: "/manager/tables", label: "Tables", icon: Table2 },
  { href: "/manager/staff", label: "Staff", icon: Users },
  { href: "/manager/happy-hour", label: "Happy hour", icon: Clock, feature: "happy-hour" },
  { href: "/manager/reservations", label: "Reservations", icon: CalendarDays, feature: "reservations" },
  { href: "/manager/events", label: "Events", icon: PartyPopper, feature: "events" },
  { href: "/manager/promotions", label: "Promotions", icon: Tag, feature: "promotions" },
  { href: "/manager/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
  { href: "/manager/qr", label: "QR codes", icon: QrCode },
  { href: "/manager/cashout", label: "Cash-out", icon: Wallet },
  { href: "/manager/audit", label: "Audit trail", icon: ListChecks },
  ...(isDemoMode() ? [{ href: "/manager/subscription", label: "Subscription", icon: CreditCard }] : []),
  { href: "/manager/settings", label: "Settings", icon: Settings },
];

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [venueName, setVenueName] = useState<string | null>(null);
  const { hasFeature } = useEntitlements();
  const nav = NAV.filter((item) => !item.feature || hasFeature(item.feature));

  useEffect(() => {
    venueService.getVenue().then((v) => setVenueName(v.name));
  }, []);
  const onOnboarding = pathname.startsWith("/manager/onboarding");
  const isActive = (href: string) =>
    href === "/manager" ? pathname === "/manager" : pathname.startsWith(href);

  // First run: the demo starts with the onboarding wizard.
  useEffect(() => {
    if (isDemoMode() && !onOnboarding && !isManagerOnboarded()) router.replace("/manager/onboarding");
  }, [onOnboarding, pathname, router]);

  // The wizard gets a clean, chrome-free canvas.
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

  return (
    <RequireAuth>
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex print:md:hidden">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <BrandLogo href="/manager" />
          <ThemeToggle />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{venueName ?? "…"}</p>
          <AuthBanner className="mt-1" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header + scrolling nav */}
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg md:hidden print:hidden">
          <div className="flex h-12 items-center justify-between px-4">
            <BrandLogo href="/manager" variant="mark" />
            <div className="flex items-center gap-1">
              <RoleBadge role="manager" />
              <AuthBanner className="[&>span]:hidden sm:[&>span]:inline" />
              <ThemeToggle />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive(item.href)
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </RequireAuth>
  );
}
