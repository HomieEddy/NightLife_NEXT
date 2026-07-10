"use client";

import { Clock, LifeBuoy, Martini, Receipt, ShoppingBag } from "lucide-react";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useGuest } from "@/context/guest-context";
import { mockVenue } from "@/lib/mock-data/venue";
import { useLastCall } from "@/lib/use-last-call";

export default function GuestTabsLayout({ children }: { children: React.ReactNode }) {
  const { table, cartCount } = useGuest();
  const lastCallActive = useLastCall();

  return (
    <>
      <div className="sticky top-0 z-30">
        {lastCallActive && (
          <div className="flex items-center justify-center gap-1.5 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-black">
            <Clock className="size-3.5" /> Last call — no new orders tonight. Thanks for being here!
          </div>
        )}
        <header className="border-b bg-background/90 backdrop-blur-lg">
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
      </div>
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
