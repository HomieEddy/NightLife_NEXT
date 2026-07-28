"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Wallet, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { guestsService } from "@/features/guests/services";
import { ordersService } from "@/features/ordering/services";
import { venueService } from "@/features/venue/services";
import { staffService } from "@/features/workforce/staff-service";
import { cashoutService } from "@/features/platform/cashout-service";
import { permissionService } from "@/features/platform/permission-service";
import { canDo } from "@/features/shared/permissions";
import { businessDateFor, computeCashoutVariance, emptyMethodTotals } from "@/lib/tab";
import { formatMoney } from "@/features/shared/format";
import type { SettlementMethod, ShiftCashout, StaffMember } from "@/lib/types";

const METHODS: { id: SettlementMethod; label: string }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "cash", label: "Cash" },
  { id: "house", label: "House account" },
];

export default function CashoutPage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [canClose, setCanClose] = useState(false);
  const [nightEndHour, setNightEndHour] = useState(10);
  const [businessDate, setBusinessDate] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [expected, setExpected] = useState<Record<SettlementMethod, number>>(emptyMethodTotals());
  const [counted, setCounted] = useState<Record<SettlementMethod, number>>(emptyMethodTotals());
  const [history, setHistory] = useState<ShiftCashout[] | null>(null);
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);

  const refresh = useCallback(async () => {
    const [currentStaff, permissions, venue, sessionList, orderList, adjustmentList, cashouts] = await Promise.all([
      staffService.getCurrentStaff(),
      permissionService.getRolePermissions("venue-1"),
      venueService.getVenueSnapshot(),
      guestsService.listSessions(),
      ordersService.listOrders(),
      ordersService.listAllAdjustments(),
      cashoutService.listCashouts(),
    ]);
    setMe(currentStaff);
    setCanClose(canDo(permissions, currentStaff.role, "cashout:close"));
    setNightEndHour(venue.nightEndHour);
    const today = businessDateFor(new Date().toISOString(), venue.nightEndHour);
    setBusinessDate(today);
    setHistory(cashouts);
    const preview = await cashoutService.previewExpected(today, venue.nightEndHour, sessionList, orderList, adjustmentList);
    setExpected(preview);
    setLoaded(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const variance = useMemo(() => computeCashoutVariance(expected, counted), [expected, counted]);
  const totalExpected = expected.terminal + expected.cash + expected.house;
  const totalCounted = counted.terminal + counted.cash + counted.house;

  async function closeCashout() {
    if (!me) return;
    setClosing(true);
    try {
      await cashoutService.closeCashout({
        businessDate,
        expectedByMethod: expected,
        countedByMethod: counted,
        note: note || undefined,
        closedByStaffId: me.id,
        closedByStaffName: me.name,
      });
      toast.success(`Cash-out closed for ${businessDate} — variance ${formatMoney(variance / 100)}`);
      setCounted(emptyMethodTotals());
      setNote("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close the cash-out");
    } finally {
      setClosing(false);
    }
  }

  if (me && !canClose) {
    return (
      <div className="space-y-5">
        <PageHeader title="Cash-out" description="Nightly reconciliation by settlement method." />
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
            <ShieldOff className="size-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="font-semibold">Access restricted</p>
          <p className="text-sm text-muted-foreground">Only managers and bartenders (own drawer) can close a cash-out.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cash-out"
        description={`Business date ${businessDate || "…"} — the venue's night runs to ${nightEndHour}:00.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-primary" /> Tonight&apos;s reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loaded ? (
            <ListSkeleton rows={3} rowHeight="h-14" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {METHODS.map((m) => (
                  <div key={m.id} className="space-y-1.5 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Expected <span className="font-semibold tabular-nums text-foreground">{formatMoney(expected[m.id] / 100)}</span>
                    </p>
                    <Label htmlFor={`counted-${m.id}`} className="text-xs">Counted</Label>
                    <Input
                      id={`counted-${m.id}`}
                      type="number"
                      step="0.01"
                      value={counted[m.id] / 100}
                      onChange={(e) =>
                        setCounted((prev) => ({ ...prev, [m.id]: Math.round(Number(e.target.value || 0) * 100) }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Expected total</p>
                  <p className="font-semibold tabular-nums">{formatMoney(totalExpected / 100)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Counted total</p>
                  <p className="font-semibold tabular-nums">{formatMoney(totalCounted / 100)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Variance</p>
                  <p className={
                    "font-semibold tabular-nums " +
                    (variance === 0 ? "text-emerald-600 dark:text-emerald-400" : variance > 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")
                  }>
                    {variance >= 0 ? "+" : ""}{formatMoney(variance / 100)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cashout-note">Note (optional)</Label>
                <Input id="cashout-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain a variance, if any…" />
              </div>

              <ConfirmDialog
                trigger={<Button disabled={closing || !me}>{closing ? "Closing…" : "Close cash-out"}</Button>}
                title={`Close cash-out for ${businessDate}?`}
                description={`Variance ${formatMoney(variance / 100)} across ${METHODS.length} methods. This is recorded on the audit trail and can't be edited afterward.`}
                confirmLabel="Close cash-out"
                onConfirm={closeCashout}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {history === null ? (
            <ListSkeleton rows={2} rowHeight="h-12" />
          ) : history.length === 0 ? (
            <EmptyState icon={Wallet} title="No cash-outs yet" description="Closed reconciliations appear here." />
          ) : (
            <ul className="divide-y">
              {history.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{c.businessDate}{c.staffId ? " · own drawer" : " · venue-wide"}</p>
                    <p className="text-xs text-muted-foreground">
                      Closed by {c.closedByStaffName} · {new Date(c.closedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={
                    "font-semibold tabular-nums " +
                    (c.varianceCents === 0 ? "text-emerald-600 dark:text-emerald-400" : c.varianceCents > 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")
                  }>
                    {c.varianceCents >= 0 ? "+" : ""}{formatMoney(c.varianceCents / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
