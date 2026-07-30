"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { guestsService } from "@/features/guests/services";
import { reservationService } from "@/features/hospitality/reservation-service";
import { staffService } from "@/features/workforce/staff-service";
import { canDo } from "@/features/shared/permissions";
import { permissionService } from "@/features/platform/permission-service";
import { sessionsKeys } from "@/features/guests/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { permissionsKeys, } from "@/features/platform/query-keys";
import { reservationsKeys } from "@/features/hospitality/query-keys";
import { useAuth } from "@/context/auth-context";
import { timeAgo } from "@/features/shared/format";
import { useLiveEvents } from "@/lib/use-live-events";
import type { GuestSession, SettlementMethod, StaffMember } from "@/lib/types";

export default function StaffApprovalsPage() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const [closing, setClosing] = useState<GuestSession | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<SettlementMethod | "">("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: sessionsKeys.all(venueId) });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: permissions } = useQuery({
    queryKey: permissionsKeys.role(venueId),
    queryFn: () => permissionService.getRolePermissions("venue-1"),
    enabled: !!venueId,
  });

  const { data: allSessions, isLoading } = useQuery({
    queryKey: sessionsKeys.all(venueId),
    queryFn: () => guestsService.listSessions(),
    enabled: !!venueId,
  });

  // Promoters also need their own reservations to filter sessions by table
  const { data: myReservations } = useQuery({
    queryKey: reservationsKeys.mine(venueId, me?.id ?? ""),
    queryFn: () => reservationService.listMyReservations(me!.id),
    enabled: !!venueId && me?.role === "promoter" && !!me,
  });

  useLiveEvents({
    scope: "staff",
    onEvent: invalidate,
    fallbackMs: 8000,
    fallbackRefresh: invalidate,
  });

  const decideMutation = useMutation({
    mutationFn: ({ session, status }: { session: GuestSession; status: "approved" | "denied" }) =>
      guestsService.setSessionStatus(session.id, status),
    onSuccess: (_, { session, status }) => {
      toast[status === "approved" ? "success" : "info"](
        `${session.displayName} at ${session.tableCode} ${status}`,
      );
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update the guest session.");
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ session, method }: { session: GuestSession; method: SettlementMethod }) =>
      guestsService.setSessionStatus(session.id, "closed", method),
    onSuccess: (_, { session }) => {
      toast.success(`Tab closed for ${session.displayName} at ${session.tableCode}`);
      setClosing(null);
      setSettlementMethod("");
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not close the tab.");
    },
  });

  // Filter sessions for promoters
  const sessions = (() => {
    if (!allSessions) return null;
    if (me?.role === "promoter" && myReservations) {
      const myTableIds = new Set(myReservations.map((r) => r.tableId).filter(Boolean));
      return allSessions.filter(
        (s) => s.promoterId === me.id || myTableIds.has(s.tableId),
      );
    }
    return allSessions;
  })();

  const pending = (sessions ?? []).filter((s) => s.status === "pending");
  const closures = (sessions ?? []).filter((s) => s.status === "closure-requested");
  const recent = (sessions ?? [])
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

  const busyId =
    (decideMutation.isPending ? decideMutation.variables?.session.id : null) ??
    (closeMutation.isPending ? closeMutation.variables?.session.id : null);

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <h1 className="text-display text-xl">Guest approvals</h1>

      {isLoading && !sessions ? (
        <ListSkeleton rows={3} rowHeight="h-28" />
      ) : (
        <>
          <section className="stagger-children space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Waiting ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="No pending requests"
                description="When guests scan their table QR code, they'll appear here for approval."
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
                    {(me as StaffMember | undefined)?.role !== "promoter" && (
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
                          onConfirm={() => decideMutation.mutate({ session, status: "approved" })}
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
                          onConfirm={() => decideMutation.mutate({ session, status: "denied" })}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {closures.length > 0 && (
            <section className="stagger-children space-y-3">
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
            <section className="stagger-children space-y-3">
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
            <Button variant="ghost" onClick={() => setClosing(null)} disabled={closeMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => closing && settlementMethod && closeMutation.mutate({ session: closing, method: settlementMethod as SettlementMethod })}
              disabled={!settlementMethod || closeMutation.isPending}
            >
              Record & close tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
