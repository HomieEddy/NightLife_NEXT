"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftRight, CalendarDays, CalendarOff, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { staffService } from "@/features/workforce/staff-service";
import { timeService } from "@/features/workforce/time-service";
import { venueService } from "@/features/venue/services";
import { staffKeys, timeKeys } from "@/features/workforce/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { useAuth } from "@/context/auth-context";
import type { Shift } from "@/lib/types";

function shiftTime(s: Shift): string {
  if (!s.scheduledStart) return "—";
  const start = new Date(s.scheduledStart);
  const end = new Date(s.scheduledEnd);
  return `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")} – ${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
}

export default function StaffSchedulePage() {
  const { user } = useAuth();
  const t = useTranslations("staff.schedule");
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  // Time-off dialog
  const [toOpen, setToOpen] = useState(false);
  const [toStart, setToStart] = useState("");
  const [toEnd, setToEnd] = useState("");
  const [toReason, setToReason] = useState("");

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: shifts } = useQuery({
    queryKey: timeKeys.shifts(venueId, me?.id ?? ""),
    queryFn: () => timeService.listShifts(me!.id),
    enabled: !!venueId && !!me?.id,
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: timeKeys.swaps(venueId),
    queryFn: () => timeService.listSwapRequests(),
    enabled: !!venueId,
  });

  const { data: timeOffRequests = [] } = useQuery({
    queryKey: timeKeys.timeOff(venueId, me?.id ?? ""),
    queryFn: () => timeService.listTimeOffRequests(me!.id),
    enabled: !!venueId && !!me?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: timeKeys.all(venueId) });
  };

  const requestSwapMutation = useMutation({
    mutationFn: (shift: Shift) =>
      timeService.requestSwap({ venueId: shift.venueId, shiftId: shift.id, requestedByStaffId: me!.id, status: "open" }),
    onSuccess: () => {
      toast.success(t("swapRequestedToast"));
      invalidate();
    },
  });

  const claimSwapMutation = useMutation({
    mutationFn: (swapId: string) => timeService.claimSwap(swapId, me!.id),
    onSuccess: () => {
      toast.success(t("swapClaimedToast"));
      invalidate();
    },
  });

  const timeOffMutation = useMutation({
    mutationFn: async () => {
      await timeService.requestTimeOff({
        venueId: venueId, staffId: me!.id, startDate: toStart, endDate: toEnd, reason: toReason,
      });
    },
    onSuccess: () => {
      setToOpen(false); setToStart(""); setToEnd(""); setToReason("");
      toast.success(t("timeOffRequestedToast"));
      invalidate();
    },
    onError: () => toast.error(t("pickDatesError")),
  });

  function handleRequestTimeOff() {
    if (!toStart || !toEnd) { toast.error(t("pickDatesError")); return; }
    timeOffMutation.mutate();
  }

  const zoneName = (id: string | null) => id ? zones.find((z) => z.id === id)?.name ?? "—" : "—";
  const STATUS_STYLES: Record<string, string> = {
    published: "bg-cyan-500/10 text-cyan-600", confirmed: "bg-emerald-500/10 text-emerald-600",
    "in-progress": "bg-amber-500/10 text-amber-600", completed: "bg-muted text-muted-foreground",
    cancelled: "bg-red-500/10 text-red-600", "no-show": "bg-red-500/10 text-red-600",
  };

  const publishedShifts = (shifts ?? []).filter((s) => s.status !== "cancelled");

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display flex items-center gap-2 text-xl">
            <CalendarDays className="size-5 text-primary" /> {t("title")}
          </h1>
          {me && <p className="mt-0.5 text-sm text-muted-foreground capitalize">{me.role} · {t("publishedShifts")}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setToOpen(true)}>
            <CalendarOff className="size-3.5 mr-1" /> {t("timeOff")}
          </Button>
        </div>
      </div>

      {shifts === undefined ? (
        <ListSkeleton rows={3} rowHeight="h-20" />
      ) : publishedShifts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="stagger-children space-y-3">
          {publishedShifts.map((shift) => (
            <Card key={shift.id} className="py-4">
              <CardContent className="space-y-2 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{new Date(shift.businessDate).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="size-3.5" /> {shiftTime(shift)}
                      <span className="text-xs ml-2">{zoneName(shift.zoneId || null)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={STATUS_STYLES[shift.status] ?? ""}>{shift.status}</Badge>
                    <ConfirmDialog
                      trigger={<Button variant="ghost" size="icon" aria-label={t("offerSwap")}><ArrowLeftRight className="size-4" /></Button>}
                      title={t("swapTitle", { day: new Date(shift.businessDate).toLocaleDateString("en-CA", { weekday: "short" }) })}
                      description={t("swapDesc")}
                      confirmLabel={t("offerSwap")}
                      onConfirm={() => requestSwapMutation.mutate(shift)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Open swaps */}
          {swapRequests.filter((s) => s.status === "open").length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mt-6 mb-2">{t("openSwaps")}</h2>
              {swapRequests.filter((s) => s.status === "open").map((s) => (
                <Card key={s.id} className="py-3 mb-2">
                  <CardContent className="flex items-center justify-between px-4">
                    <p className="text-sm">{t("swapOpenClaim")}</p>
                    <Button size="sm" onClick={() => claimSwapMutation.mutate(s.id)}>{t("claim")}</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Time-off requests */}
          {timeOffRequests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mt-6 mb-2">{t("timeOff")}</h2>
              {timeOffRequests.map((r) => (
                <Card key={r.id} className="py-2 mb-2">
                  <CardContent className="flex items-center justify-between px-4">
                    <p className="text-sm">
                      {r.startDate} – {r.endDate}
                      {r.reason && <span className="text-muted-foreground"> · {r.reason}</span>}
                    </p>
                    <Badge variant="outline">{r.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Time-off dialog */}
      <Dialog open={toOpen} onOpenChange={setToOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("requestTimeOff")}</DialogTitle>
            <DialogDescription>{t("requestTimeOffDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="to-start">{t("start")}</Label><Input id="to-start" type="date" value={toStart} onChange={(e) => setToStart(e.target.value)} /></div>
              <div><Label htmlFor="to-end">{t("end")}</Label><Input id="to-end" type="date" value={toEnd} onChange={(e) => setToEnd(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="to-reason">{t("reasonOptional")}</Label><Input id="to-reason" value={toReason} onChange={(e) => setToReason(e.target.value)} placeholder={t("vacation")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleRequestTimeOff}>{t("request")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
