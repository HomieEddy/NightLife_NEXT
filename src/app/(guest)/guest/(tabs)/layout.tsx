"use client";

import { LifeBuoy, Martini, Receipt, ShoppingBag } from "lucide-react";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useGuest } from "@/context/guest-context";
import { mockVenue } from "@/lib/mock-data/venue";

export default function GuestTabsLayout({ children }: { children: React.ReactNode }) {
  const { table, cartCount } = useGuest();

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg">
        <div className="flex h-12 items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">{mockVenue.name}</span>
          <div className="flex items-center gap-1">
            {table && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-xs text-primary">
                {table.tableCode}
              </span>
            )}
            <ThemeToggle className="size-8" />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-24">{children}</main>
      <MobileBottomNav
        className="mx-auto max-w-lg"
        items={[
          { href: "/guest/menu", label: "Menu", icon: Martini },
          { href: "/guest/cart", label: "Cart", icon: ShoppingBag, badgeCount: cartCount },
          { href: "/guest/orders", label: "Orders", icon: Receipt },
          { href: "/guest/help", label: "Help", icon: LifeBuoy },
        ]}
      />
    </>
  );
}
