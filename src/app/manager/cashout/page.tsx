"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wallet, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { usePermissions } from "@/features/platform/use-permissions";
import { businessDateFor, computeCashoutVariance, emptyMethodTotals } from "@/lib/tab";
import { formatMoney } from "@/features/shared/format";
import { useAuth } from "@/context/auth-context";
import { staffKeys } from "@/features/workforce/query-keys";
import { cashoutKeys } from "@/features/platform/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { sessionsKeys } from "@/features/guests/query-keys";
import { ordersKeys } from "@/features/ordering/query-keys";
import type { SettlementMethod, ShiftCashout } from "@/lib/types";

export default function CashoutPage() {
  const t = useTranslations("manager.cashout");
  const ts = useTranslations("shared");
  const { user } = useAuth();

  const METHODS: { id: SettlementMethod; label: string }[] = [
    { id: "terminal", label: t("terminal") },
    { id: "cash", label: t("cash") },
    { id: "house", label: t("house") },
  ];
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const [counted, setCounted] = useState<Record<SettlementMethod, number>>(emptyMethodTotals());
  const [note, setNote] = useState("");

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { can } = usePermissions();

  const { data: venue } = useQuery({
    queryKey: venueKeys.snapshot(venueId),
    queryFn: () => venueService.getVenueSnapshot(),
    enabled: !!venueId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: sessionsKeys.all(venueId),
    queryFn: () => guestsService.listSessions(),
    enabled: !!venueId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ordersKeys.all(venueId),
    queryFn: () => ordersService.listOrders(),
    enabled: !!venueId,
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ordersKeys.adjustments(venueId),
    queryFn: () => ordersService.listAllAdjustments(),
    enabled: !!venueId,
  });

  const { data: history = [] } = useQuery({
    queryKey: cashoutKeys.all(venueId),
    queryFn: () => cashoutService.listCashouts(),
    enabled: !!venueId,
  });

  const nightEndHour = venue?.nightEndHour ?? 10;
  const businessDate = venue ? businessDateFor(new Date().toISOString(), venue.nightEndHour) : "";

  const { data: expected } = useQuery({
    queryKey: cashoutKeys.preview(venueId),
    queryFn: () =>
      cashoutService.previewExpected(businessDate, nightEndHour, sessions, orders, adjustments),
    enabled: !!venueId && !!venue && sessions.length >= 0 && orders.length >= 0,
  });

  const canClose = can("cashout:close");

  const expectedByMethod = expected ?? emptyMethodTotals();
  const variance = useMemo(
    () => computeCashoutVariance(expectedByMethod, counted),
    [expectedByMethod, counted],
  );
  const totalExpected = expectedByMethod.terminal + expectedByMethod.cash + expectedByMethod.house;
  const totalCounted = counted.terminal + counted.cash + counted.house;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: cashoutKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: cashoutKeys.preview(venueId) });
  };

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not authenticated");
      return cashoutService.closeCashout({
        businessDate,
        expectedByMethod,
        countedByMethod: counted,
        note: note || undefined,
        closedByStaffId: me.id,
        closedByStaffName: me.name,
      });
    },
    onSuccess: () => {
      toast.success(t("cashoutClosed", { date: businessDate, variance: formatMoney(variance / 100) }));
      setCounted(emptyMethodTotals());
      setNote("");
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("couldNotClose"));
    },
  });

  if (me && !canClose) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
            <ShieldOff className="size-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="font-semibold">{t("accessRestricted")}</p>
          <p className="text-sm text-muted-foreground">{t("accessRestrictedDesc")}</p>
        </div>
      </div>
    );
  }

  const loaded = me !== undefined && venue !== undefined && history !== undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("businessDate", { date: businessDate || "…", hour: nightEndHour })}
        breadcrumbs={[{ label: t("insights"), href: "/manager/reports" }, { label: t("cashOut") }]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-primary" /> {t("tonightReconciliation")}
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
                      {t("expected")} <span className="font-semibold tabular-nums text-foreground">{formatMoney(expectedByMethod[m.id] / 100)}</span>
                    </p>
                    <Label htmlFor={`counted-${m.id}`} className="text-xs">{t("counted")}</Label>
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
                  <p className="text-xs text-muted-foreground">{t("expectedTotal")}</p>
                  <p className="font-semibold tabular-nums">{formatMoney(totalExpected / 100)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("countedTotal")}</p>
                  <p className="font-semibold tabular-nums">{formatMoney(totalCounted / 100)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("variance")}</p>
                  <p className={
                    "font-semibold tabular-nums " +
                    (variance === 0 ? "text-emerald-600 dark:text-emerald-400" : variance > 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")
                  }>
                    {variance >= 0 ? "+" : ""}{formatMoney(variance / 100)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cashout-note">{t("noteOptional")}</Label>
                <Input id="cashout-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
              </div>

              <ConfirmDialog
                trigger={<Button disabled={closeMutation.isPending || !me}>{closeMutation.isPending ? t("closing") : t("closeCashout")}</Button>}
                title={t("closeCashoutTitle", { date: businessDate })}
                description={t("closeCashoutDesc", { variance: formatMoney(variance / 100), methods: METHODS.length })}
                confirmLabel={t("closeConfirm")}
                onConfirm={() => closeMutation.mutate()}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history === undefined ? (
            <ListSkeleton rows={2} rowHeight="h-12" />
          ) : history.length === 0 ? (
            <EmptyState icon={Wallet} title={t("noCashouts")} description={t("noCashoutsDesc")} />
          ) : (
            <ul className="divide-y">
              {history.map((c: ShiftCashout) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{c.businessDate}{c.staffId ? t("ownDrawer") : t("venueWide")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("closedBy", { name: c.closedByStaffName })} · {new Date(c.closedAt).toLocaleString()}
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
