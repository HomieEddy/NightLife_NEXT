"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { Gift, MapPin } from "lucide-react";

export function OrderCard({
  order,
  footer,
  compact = false,
  className,
}: {
  order: Order;
  /** Action row rendered below the items (e.g. advance-status buttons). */
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("py-4 gap-3", className)}>
      <CardContent className="px-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{order.code}</span>
              <StatusBadge status={order.status} pulse={order.status === "pending"} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {order.tableCode} · {order.zoneName} · {order.guestName}
            </p>
            {order.giftToTableCode && (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                <Gift className="size-3" /> Deliver to {order.giftToTableCode} — anonymous gift
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatMoney(order.total)}</p>
            <p className="text-xs text-muted-foreground">{timeAgo(order.placedAt)}</p>
          </div>
        </div>

        {!compact && (
          <ul className="space-y-1 border-t pt-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium text-primary">{item.quantity}×</span> {item.name}
                  {item.modifiers.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {item.modifiers.map((m) => m.optionName).join(", ")}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(
                    (item.unitPrice + item.modifiers.reduce((s, m) => s + m.priceDelta, 0)) *
                      item.quantity,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {footer && <div className="border-t pt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}
