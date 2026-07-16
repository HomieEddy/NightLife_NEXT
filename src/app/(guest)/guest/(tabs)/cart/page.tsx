"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CartContents } from "@/components/guest/cart-contents";
import { ClosureGate } from "@/components/guest/closure-gate";

export default function GuestCartPage() {
  return (
    <ClosureGate>
      <div className="space-y-4 p-4 animate-fade-in">
        <PageHeader title="Your cart" description="Review, tip and place your order." />
        <CartContents />
      </div>
    </ClosureGate>
  );
}
