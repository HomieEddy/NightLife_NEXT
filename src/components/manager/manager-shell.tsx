"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  Ellipsis,
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
import {
  MANAGER_NAV_GROUPS,
  MANAGER_FOOTER_ITEMS,
  DEMO_FOOTER_ITEMS,
  isNavActive,
} from "@/lib/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { NavGroup } from "@/lib/navigation";

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [venueName, setVenueName] = useState<string | null>(null);
  const { hasFeature } = useEntitlements();

  // Filter groups by entitlements — a group with zero visible items hides entirely.
  const groups: NavGroup[] = MANAGER_NAV_GROUPS
    .map((g) => ({
      label: g.label,
      items: g.items.filter((item) => !item.feature || hasFeature(item.feature)),
    }))
    .filter((g) => g.items.length > 0);

  const footerItems = isDemoMode() ? DEMO_FOOTER_ITEMS : MANAGER_FOOTER_ITEMS;

  useEffect(() => {
    venueService.getVenue().then((v) => setVenueName(v.name));
  }, []);
  const onOnboarding = pathname.startsWith("/manager/onboarding");

  // First run: the demo starts with the onboarding wizard.
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

  function navLink(item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }, className?: string) {
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
          className,
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
        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            {group.items.map((item) => navLink(item))}
          </div>
        ))}
      </>
    );
  }

  function footer() {
    return (
      <div className="border-t p-3 space-y-1">
        {footerItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        ))}
        <div className="mt-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">{venueName ?? "…"}</p>
          <AuthBanner className="mt-0.5" />
        </div>
      </div>
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
        <nav className="flex-1 overflow-y-auto p-3">
          {groupedNav()}
        </nav>
        {footer()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header + bottom nav */}
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg md:hidden print:hidden">
          <div className="flex h-12 items-center justify-between px-4">
            <BrandLogo href="/manager" variant="mark" />
            <div className="flex items-center gap-1">
              <RoleBadge role="manager" />
              <Sheet>
                <SheetTrigger asChild>
                  <button className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium" aria-label="More navigation">
                    <Ellipsis className="size-4" /> More
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80dvh] overflow-y-auto rounded-t-xl">
                  <div className="space-y-4 pt-2">
                    {groupedNav()}
                    <hr />
                    {footer()}
                  </div>
                </SheetContent>
              </Sheet>
              <AuthBanner className="[&>span]:hidden sm:[&>span]:inline" />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </RequireAuth>
  );
}
