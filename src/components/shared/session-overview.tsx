"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/shared/order-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SessionActionsDialog } from "@/components/shared/session-actions-dialog";
import { ordersService } from "@/lib/services/orders-service";
import { computeSessionBalance, shortfallRatio } from "@/lib/tab";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GuestSession, MenuItem, Order, TabAdjustment, VenueTable } from "@/lib/types";

/**
 * Groups orders under their guest session and totals each session
 * independently (every order already carries its own fees in `total`).
 */
export function SessionOverview({
  sessions,
  orders,
  tables = [],
  menuItems = [],
  minimumSpendWarningRatio = 0.25,
  staffContext,
}: {
  sessions: GuestSession[];
  orders: Order[];
  /** Tables + staff identity/capabilities — pass to enable transfer/merge actions. Omit for a read-only view. */
  tables?: VenueTable[];
  /** For the responsible-service drink counter (plan 17). */
  menuItems?: MenuItem[];
  minimumSpendWarningRatio?: number;
  staffContext?: {
    staffId: string;
    staffName: string;
    canTransfer: boolean;
    canMerge: boolean;
    canRefuseService?: boolean;
    onChange: () => void;
  };
}) {
  const openSessions = sessions.filter((s) => s.status === "approved");
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
          tables={tables}
          menuItems={menuItems}
          otherOpenSessions={openSessions.filter((s) => s.id !== session.id)}
          minimumSpendWarningRatio={minimumSpendWarningRatio}
          staffContext={staffContext}
        />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  orders,
  tables,
  menuItems,
  otherOpenSessions,
  minimumSpendWarningRatio,
  staffContext,
}: {
  session: GuestSession;
  orders: Order[];
  tables: VenueTable[];
  menuItems: MenuItem[];
  otherOpenSessions: GuestSession[];
  minimumSpendWarningRatio: number;
  staffContext?: {
    staffId: string;
    staffName: string;
    canTransfer: boolean;
    canMerge: boolean;
    canRefuseService?: boolean;
    onChange: () => void;
  };
}) {
  const [open, setOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<TabAdjustment[]>([]);
  const total = orders.reduce((s, o) => s + o.total, 0);

  useEffect(() => {
    ordersService.listAdjustments(session.id).then(setAdjustments);
  }, [session.id, orders]);

  const balance = computeSessionBalance(session.id, orders, adjustments, session.minimumSpendCents ?? 0);
  const hasMinimum = balance.minimumSpendCents > 0;
  const progressPct = hasMinimum ? Math.min(100, (balance.netCents / balance.minimumSpendCents) * 100) : 0;
  const ratio = shortfallRatio(balance);
  const isWarning = hasMinimum && ratio > 0 && ratio >= minimumSpendWarningRatio;

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

        {hasMinimum && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Minimum spend {formatMoney(balance.minimumSpendCents / 100)}
              </span>
              <span className={cn("font-medium tabular-nums", isWarning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                {balance.shortfallCents > 0
                  ? `${formatMoney(balance.shortfallCents / 100)} short`
                  : "Met"}
              </span>
            </div>
            <Progress
              value={progressPct}
              className={cn(isWarning && "[&>div]:bg-amber-500")}
            />
          </div>
        )}

        {balance.adjustmentsCents > 0 && (
          <p className="text-xs text-muted-foreground">
            {balance.voidCents > 0 && `Void ${formatMoney(balance.voidCents / 100)} · `}
            {balance.compCents > 0 && `Comp ${formatMoney(balance.compCents / 100)} · `}
            {balance.discountCents > 0 && `Discount ${formatMoney(balance.discountCents / 100)} · `}
            Net {formatMoney(balance.netCents / 100)}
          </p>
        )}

        {staffContext && session.status === "approved" && (staffContext.canTransfer || staffContext.canMerge || staffContext.canRefuseService) && (
          <SessionActionsDialog
            session={session}
            orders={orders}
            tables={tables}
            menuItems={menuItems}
            otherOpenSessions={otherOpenSessions}
            canTransfer={staffContext.canTransfer}
            canMerge={staffContext.canMerge}
            canRefuseService={staffContext.canRefuseService}
            authorStaffId={staffContext.staffId}
            authorStaffName={staffContext.staffName}
            onDone={staffContext.onChange}
            trigger={
              <Button variant="outline" size="sm">
                <Wallet className="size-3.5" /> Transfer / merge / split
              </Button>
            }
          />
        )}

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
