"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OrderCard } from "@/components/shared/order-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { GuestSession, Order } from "@/lib/types";

/**
 * Groups orders under their guest session and totals each session
 * independently (every order already carries its own fees in `total`).
 */
export function SessionOverview({ sessions, orders }: { sessions: GuestSession[]; orders: Order[] }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No active sessions"
        description="Guest sessions appear here as tables check in."
      />
    );
  }
  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          orders={orders.filter((o) => o.sessionId === session.id)}
        />
      ))}
    </div>
  );
}

function SessionCard({ session, orders }: { session: GuestSession; orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const total = orders.reduce((s, o) => s + o.total, 0);

  return (
    <Card className="py-4">
      <CardContent className="space-y-3 px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <p className="font-medium">{session.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {session.tableCode} · {session.zoneName} · {session.partySize} guests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={session.status} />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{orders.length} orders</p>
              <p className="font-semibold tabular-nums">{formatMoney(total)}</p>
            </div>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {open &&
          (orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders on this session yet.</p>
          ) : (
            <div className="grid gap-3 border-t pt-3 md:grid-cols-2">
              {orders.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
