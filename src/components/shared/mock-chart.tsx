"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { RevenuePoint } from "@/lib/types";

/**
 * Lightweight CSS bar chart — no chart library needed for the prototype.
 * TODO(backend): swap for a real charting lib (e.g. recharts) once live data lands.
 */
export function MockChart({
  data,
  className,
  height = 180,
}: {
  data: RevenuePoint[];
  className?: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {data.map((point, i) => (
          <button
            key={`${point.label}-${i}`}
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="group relative flex h-full flex-1 flex-col justify-end outline-none"
            aria-label={`${point.label}: ${formatMoney(point.revenue)}`}
          >
            {active === i && (
              <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                <span className="font-semibold">{formatMoney(point.revenue)}</span>
                <span className="text-muted-foreground"> · {point.orders} orders</span>
              </div>
            )}
            <div
              className={cn(
                "w-full rounded-t-md bg-gradient-to-t from-primary/50 to-primary transition-all",
                active === i ? "opacity-100 glow-primary" : "opacity-70 group-hover:opacity-100",
              )}
              style={{ height: `${Math.max(4, (point.revenue / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {data.map((point, i) => (
          <span
            key={`label-${point.label}-${i}`}
            className="flex-1 text-center text-[10px] text-muted-foreground sm:text-xs"
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
