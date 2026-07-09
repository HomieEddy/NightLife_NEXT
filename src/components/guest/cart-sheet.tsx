"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CartContents } from "@/components/guest/cart-contents";
import { AnimatedMoney } from "@/components/fx/animated-money";
import { useGuest } from "@/context/guest-context";
import { gsap } from "@/lib/gsap";

/**
 * Floating "view cart" pill + bottom sheet. Rendered on the menu screen so
 * guests can review their order without leaving the browsing flow.
 */
export function CartSheet() {
  const { cartCount, cartSubtotal } = useGuest();
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const prevCount = useRef(cartCount);

  // Bounce the pill whenever another item lands in the cart.
  useEffect(() => {
    if (cartCount > prevCount.current && pillRef.current) {
      gsap.fromTo(
        pillRef.current,
        { scale: 0.92, y: 4 },
        { scale: 1, y: 0, duration: 0.55, ease: "elastic.out(1.1, 0.45)" },
      );
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  if (cartCount === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          ref={pillRef}
          type="button"
          className="fixed inset-x-0 bottom-16 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between rounded-full bg-primary px-5 py-3.5 font-medium text-primary-foreground shadow-lg glow-primary transition-transform active:scale-[0.98] animate-pop-in will-change-transform"
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="size-4" />
            View cart · {cartCount} {cartCount === 1 ? "item" : "items"}
          </span>
          <AnimatedMoney value={cartSubtotal} className="font-semibold" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[88dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <CartContents onSubmitted={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
