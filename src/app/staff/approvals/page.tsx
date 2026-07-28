"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, UserCheck, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { guestsService } from "@/lib/services/guests-service";
import { reservationService } from "@/lib/services/reservation-service";
import { staffService } from "@/lib/services/staff-service";
import { canDo } from "@/features/shared/permissions";
import { permissionService } from "@/lib/services/permission-service";
import type { RolePermissions } from "@/features/shared/permissions";
import { timeAgo } from "@/features/shared/format";
import { useLiveEvents } from "@/lib/use-live-events";
import { Pagination, paginate } from "@/components/shared/pagination";
import type { GuestSession, SettlementMethod, StaffMember } from "@/lib/types";

export default function StaffApprovalsPage() {
  const [sessions, setSessions] = useState<GuestSession[] | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closing, setClosing] = useState<GuestSession | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<SettlementMethod | "">("");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const [allSessions, currentStaff, perms] = await Promise.all([
      guestsService.listSessions(),
      staffService.getCurrentStaff(),
      permissionService.getRolePermissions("venue-1"),
    ]);
    setMe(currentStaff);
    setPermissions(perms);
    if (currentStaff.role === "promoter") {
      const myRes = await reservationService.listMyReservations(currentStaff.id);
      const myTableIds = new Set(myRes.map((r) => r.tableId).filter(Boolean));
      setSessions(allSessions.filter((s) => s.promoterId === currentStaff.id || myTableIds.has(s.tableId)));
    } else {
      setSessions(allSessions);
    }
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => { refresh(); }, [refresh]);

  useLiveEvents({
    scope: "staff",
    onEvent: () => refreshRef.current(),
    fallbackMs: 8000,
    fallbackRefresh: () => refreshRef.current(),
  });

  async function decide(session: GuestSession, status: "approved" | "denied") {
    setBusyId(session.id);
    try {
      await guestsService.setSessionStatus(session.id, status);
      toast[status === "approved" ? "success" : "info"](`${session.displayName} at ${session.tableCode} ${status}`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the guest session.");
    } finally {
      setBusyId(null);
    }
  }

  async function approveClosure() {
    if (!closing || !settlementMethod) return;
    const session = closing;
    setBusyId(session.id);
    try {
      await guestsService.setSessionStatus(session.id, "closed", settlementMethod);
      toast.success(`Tab closed for ${session.displayName} at ${session.tableCode}`);
      setClosing(null);
      setSettlementMethod("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close the tab.");
    } finally {
      setBusyId(null);
    }
  }

  const pagedSessions = paginate(sessions ?? [], page);
  const pending = pagedSessions.filter((s) => s.status === "pending");
  const closures = pagedSessions.filter((s) => s.status === "closure-requested");
  const recent = pagedSessions
    .filter((s) => !["pending", "closure-requested"].includes(s.status))
    .slice(0, 6);

  if (me && permissions && !canDo(permissions, me.role, "session:approve")) {
    return (
      <div className="p-4">
        <EmptyState
          icon={UserCheck}
          title="Not available for your role"
          description="Guest approvals are handled by hosts and managers."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-display text-xl">Guest approvals</h1>

      {sessions === null ? (
        <ListSkeleton rows={3} rowHeight="h-28" />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Waiting ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="No pending requests"
                description="New table join requests will show up here."
              />
            ) : (
              pending.map((session) => (
                <Card key={session.id} className="border-amber-500/30 py-4">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{session.displayName}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" /> Party of {session.partySize} ·{" "}
                          {session.tableCode} · {session.zoneName}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(session.createdAt)}
                      </span>
                    </div>
                    {me?.role !== "promoter" && (
                    <div className="flex gap-2">
                      <ConfirmDialog
                        trigger={
                          <Button className="h-11 flex-1" disabled={busyId === session.id}>
                            <Check className="size-4" /> Approve
                          </Button>
                        }
                        title={`Approve ${session.displayName}?`}
                        description={`Party of ${session.partySize} at ${session.tableCode} — they can start ordering immediately.`}
                        confirmLabel="Approve table"
                        onConfirm={() => decide(session, "approved")}
                      />
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="outline"
                            className="h-11 flex-1 text-red-600 dark:text-red-400"
                            disabled={busyId === session.id}
                          >
                            <X className="size-4" /> Deny
                          </Button>
                        }
                        title={`Deny ${session.displayName}?`}
                        description={`They'll be asked to see the host at ${session.tableCode}.`}
                        confirmLabel="Deny"
                        destructive
                        onConfirm={() => decide(session, "denied")}
                      />
                    </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {closures.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Tab closures ({closures.length})
              </h2>
              {closures.map((session) => (
                <Card key={session.id} className="border-primary/40 py-4">
                  <CardContent className="space-y-3 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Wallet className="size-5" />
                        </div>
                        <div>
                          <p className="font-medium">{session.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            Wants to close their tab · {session.tableCode} · {session.zoneName}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={session.status} pulse />
                    </div>
                    <Button className="h-11 w-full" disabled={busyId === session.id} onClick={() => setClosing(session)}>
                      <Check className="size-4" /> Record settlement & close
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {recent.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Recent decisions</h2>
              {recent.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{session.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.tableCode} · {timeAgo(session.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={session.status} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
      <Pagination totalItems={(sessions ?? []).length} currentPage={page} onPageChange={setPage} className="mt-3" />

      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close the tab for {closing?.tableCode}?</DialogTitle>
            <DialogDescription>
              Record how staff settled this tab externally. Closing ends the guest session and returns the table to reserved or open.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="settlement-method">Settlement method</Label>
            <Select value={settlementMethod} onValueChange={(value) => setSettlementMethod(value as SettlementMethod)}>
              <SelectTrigger id="settlement-method"><SelectValue placeholder="Choose a method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="terminal">Card terminal</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="house">House account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(null)} disabled={busyId === closing?.id}>Cancel</Button>
            <Button onClick={approveClosure} disabled={!settlementMethod || busyId === closing?.id}>Record & close tab</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
