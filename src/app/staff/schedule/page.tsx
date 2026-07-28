"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, CalendarDays, CalendarOff, Clock } from "lucide-react";
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
import type { Shift, StaffMember, Zone, TimeOffRequest, ShiftSwapRequest } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftTime(s: Shift): string {
  if (!s.scheduledStart) return "—";
  const start = new Date(s.scheduledStart);
  const end = new Date(s.scheduledEnd);
  return `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")} – ${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
}

export default function StaffSchedulePage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);

  // Time-off dialog
  const [toOpen, setToOpen] = useState(false);
  const [toStart, setToStart] = useState("");
  const [toEnd, setToEnd] = useState("");
  const [toReason, setToReason] = useState("");

  const refresh = async () => {
    if (!me) return;
    const [s, z, swaps, tos] = await Promise.all([
      timeService.listShifts(me.id),
      venueService.listZones(),
      timeService.listSwapRequests(),
      timeService.listTimeOffRequests(me.id),
    ]);
    setShifts(s); setZones(z); setSwapRequests(swaps); setTimeOffRequests(tos);
  };

  useEffect(() => {
    staffService.getCurrentStaff().then((current) => { setMe(current); });
  }, []);

  useEffect(() => { if (me) refresh(); }, [me]);

  const zoneName = (id: string | null) => id ? zones.find((z) => z.id === id)?.name ?? "—" : "—";
  const STATUS_STYLES: Record<string, string> = {
    published: "bg-cyan-500/10 text-cyan-600", confirmed: "bg-emerald-500/10 text-emerald-600",
    "in-progress": "bg-amber-500/10 text-amber-600", completed: "bg-muted text-muted-foreground",
    cancelled: "bg-red-500/10 text-red-600", "no-show": "bg-red-500/10 text-red-600",
  };

  async function requestSwap(shift: Shift) {
    await timeService.requestSwap({
      venueId: shift.venueId, shiftId: shift.id, requestedByStaffId: me!.id, status: "open",
    });
    toast.success("Swap requested — others with the same role can claim it.");
    await refresh();
  }

  async function claimSwap(swap: ShiftSwapRequest) {
    await timeService.claimSwap(swap.id, me!.id);
    toast.success("Swap claimed — manager will approve.");
    await refresh();
  }

  async function requestTimeOff() {
    if (!toStart || !toEnd) { toast.error("Pick start and end dates."); return; }
    await timeService.requestTimeOff({
      venueId: "venue-1", staffId: me!.id, startDate: toStart, endDate: toEnd, reason: toReason,
    });
    setToOpen(false); setToStart(""); setToEnd(""); setToReason("");
    toast.success("Time off requested.");
    await refresh();
  }

  const publishedShifts = (shifts ?? []).filter((s) => s.status !== "cancelled");

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display flex items-center gap-2 text-xl">
            <CalendarDays className="size-5 text-primary" /> My schedule
          </h1>
          {me && <p className="mt-0.5 text-sm text-muted-foreground capitalize">{me.role} · published shifts</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setToOpen(true)}>
            <CalendarOff className="size-3.5 mr-1" /> Time off
          </Button>
        </div>
      </div>

      {shifts === null ? (
        <ListSkeleton rows={3} rowHeight="h-20" />
      ) : publishedShifts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No published shifts"
          description="Published shifts will appear here once the manager generates and publishes a schedule."
        />
      ) : (
        <div className="space-y-3">
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
                      trigger={<Button variant="ghost" size="icon" aria-label="Offer swap"><ArrowLeftRight className="size-4" /></Button>}
                      title={`Swap ${new Date(shift.businessDate).toLocaleDateString("en-CA", { weekday: "short" })} shift?`}
                      description="Your shift will be posted for same-role staff to claim."
                      confirmLabel="Offer swap"
                      onConfirm={() => requestSwap(shift)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Open swaps */}
          {swapRequests.filter((s) => s.status === "open").length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mt-6 mb-2">Open swaps</h2>
              {swapRequests.filter((s) => s.status === "open").map((s) => (
                <Card key={s.id} className="py-3 mb-2">
                  <CardContent className="flex items-center justify-between px-4">
                    <p className="text-sm">Shift swap open — claim to take this shift</p>
                    <Button size="sm" onClick={() => claimSwap(s)}>Claim</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Time-off requests */}
          {timeOffRequests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mt-6 mb-2">Time off</h2>
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
            <DialogTitle>Request time off</DialogTitle>
            <DialogDescription>Dates you can't work. A manager will approve or deny.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="to-start">Start</Label><Input id="to-start" type="date" value={toStart} onChange={(e) => setToStart(e.target.value)} /></div>
              <div><Label htmlFor="to-end">End</Label><Input id="to-end" type="date" value={toEnd} onChange={(e) => setToEnd(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="to-reason">Reason (optional)</Label><Input id="to-reason" value={toReason} onChange={(e) => setToReason(e.target.value)} placeholder="Vacation" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToOpen(false)}>Cancel</Button>
            <Button onClick={requestTimeOff}>Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
