"use client";

import { usePathname } from "next/navigation";
import { Clock, LifeBuoy, Martini, Receipt, ShoppingBag } from "lucide-react";
import { CartSheet } from "@/components/guest/cart-sheet";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useGuest } from "@/context/guest-context";
import { useLastCall } from "@/lib/use-last-call";

export default function GuestTabsLayout({ children }: { children: React.ReactNode }) {
  const { table, venue, cartCount } = useGuest();
  const lastCallActive = useLastCall();
  const pathname = usePathname();
  const isCartPage = pathname === "/guest/cart";

  return (
    <>
      <div className="sticky top-0 z-30">
        {lastCallActive && (
          <div className="foil flex items-center justify-center gap-1.5 px-4 py-2 text-center text-xs font-semibold">
            <Clock className="size-3.5" /> Last call — no new orders tonight. Thanks for being here!
          </div>
        )}
        <header className="grain-overlay bg-background/90 backdrop-blur-lg">
          <div className="flex h-12 items-center justify-between px-4">
            <span className="text-display text-gradient-gold text-base">{venue?.name}</span>
            <div className="flex items-center gap-1">
              {table && (
                <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 font-mono text-xs text-gold-deep dark:text-gold">
                  {table.tableCode}
                </span>
              )}
              <ThemeToggle className="size-8" />
            </div>
          </div>
          <hr className="rule-gold" aria-hidden="true" />
        </header>
      </div>
      <main key={pathname} className="flex-1 pb-24 animate-fade-up">{children}</main>
      {!isCartPage && <CartSheet />}
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
