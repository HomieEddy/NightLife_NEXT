"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { MenuItem } from "@/lib/types";

const TAG_LABELS: Record<MenuItem["tags"][number], string> = {
  popular: "Popular",
  new: "New",
  premium: "Premium",
  limited: "Limited",
};

export function MenuItemCard({
  item,
  onClick,
  actions,
  className,
}: {
  item: MenuItem;
  onClick?: () => void;
  /** Extra controls (e.g. manager edit buttons). Rendered right-aligned. */
  actions?: ReactNode;
  className?: string;
}) {
  const soldOut = item.inventory === 0;
  const lowStock = !soldOut && item.inventory <= 5;
  const unavailable = !item.isAvailable || soldOut;
  const interactive = Boolean(onClick) && !unavailable;
  return (
    <Card
      className={cn(
        "py-3 gap-0 transition-colors",
        interactive &&
          "cursor-pointer transition-transform hover:border-primary/50 active:scale-[0.98] active:bg-accent/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        unavailable && "opacity-50",
        className,
      )}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={onClick && unavailable ? true : undefined}
    >
      <CardContent className="flex items-center gap-3 px-4">
        <BottleIcon icon={item.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{item.name}</p>
            {soldOut ? (
              <Badge variant="outline" className="shrink-0 text-xs text-red-600 dark:text-red-400">
                Sold out
              </Badge>
            ) : !item.isAvailable ? (
              <Badge variant="outline" className="shrink-0 text-xs">
                86&apos;d
              </Badge>
            ) : null}
          </div>
          <p className="text-voice truncate text-sm text-muted-foreground">{item.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-primary">
              {formatMoney(item.price)}
            </span>
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-1.5 py-px text-[10px] text-muted-foreground"
              >
                {TAG_LABELS[tag]}
              </span>
            ))}
            {lowStock && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Only {item.inventory} left
              </span>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </CardContent>
    </Card>
  );
}
