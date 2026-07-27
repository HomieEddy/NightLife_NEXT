"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive } from "@/lib/navigation";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
}

/**
 * Fixed bottom navigation for mobile app-like surfaces (guest portal, staff panel).
 * Pair with `pb-20` on the page container so content isn't hidden behind it.
 */
export function MobileBottomNav({
  items,
  className,
}: {
  items: BottomNavItem[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
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
              {item.label}
              {active && (
                <span className="absolute inset-x-1/4 top-0 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
