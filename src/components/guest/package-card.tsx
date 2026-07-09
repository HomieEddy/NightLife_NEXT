"use client";

import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { useGuest } from "@/context/guest-context";
import { formatMoney } from "@/lib/format";
import type { PackageQuote } from "@/lib/mock-services/menu-service";
import type { BottlePackage, MenuItem } from "@/lib/types";

export type PackageWithQuote = BottlePackage & { quote: PackageQuote };

/**
 * Guest-facing bottle package. Adding it creates a single cart line whose
 * "Includes" modifiers carry the contents so staff see exactly what to pour.
 */
export function PackageCard({ pkg }: { pkg: PackageWithQuote }) {
  const { addToCart } = useGuest();
  const soldOut = pkg.quote.maxQuantity === 0;

  function handleAdd() {
    // Synthetic MenuItem so packages flow through the existing cart/order pipeline.
    // TODO(backend): orders get a proper package_id line type instead.
    const syntheticItem: MenuItem = {
      id: pkg.id,
      categoryId: "packages",
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      icon: "package",
      tags: [],
      isAvailable: true,
      inventory: pkg.quote.maxQuantity,
      modifierGroups: [],
    };
    addToCart(
      syntheticItem,
      1,
      pkg.quote.lines.map((line) => ({
        groupName: "Includes",
        optionName: `${line.quantity}× ${line.name}`,
        priceDelta: 0,
      })),
    );
    toast.success(`${pkg.name} added to cart`);
  }

  return (
    <Card className={`border-primary/40 py-4 ${soldOut ? "opacity-50" : ""}`}>
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start gap-3">
          <BottleIcon icon="package" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{pkg.name}</p>
              {soldOut && (
                <Badge variant="outline" className="shrink-0 text-xs text-red-600 dark:text-red-400">
                  Sold out
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{pkg.description}</p>
          </div>
        </div>

        <ul className="space-y-1 rounded-lg bg-accent/50 p-3 text-xs">
          {pkg.quote.lines.map((line) => (
            <li key={line.menuItemId} className="flex justify-between">
              <span>
                <span className="font-medium text-primary">{line.quantity}×</span> {line.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(line.unitPrice * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold tabular-nums text-primary">{formatMoney(pkg.price)}</p>
            {pkg.quote.savings > 0 && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-3" />
                Save {formatMoney(pkg.quote.savings)} vs à la carte
              </p>
            )}
          </div>
          <Button onClick={handleAdd} disabled={soldOut} className="h-11">
            Add to cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
