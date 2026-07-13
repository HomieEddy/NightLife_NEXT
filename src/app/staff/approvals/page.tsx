"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, UserCheck, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { guestsService } from "@/lib/services/guests-service";
import { timeAgo } from "@/lib/format";
import { useLiveEvents } from "@/lib/use-live-events";
import type { GuestSession } from "@/lib/types";

export default function StaffApprovalsPage() {
  const [sessions, setSessions] = useState<GuestSession[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSessions(await guestsService.listSessions());
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
    await guestsService.setSessionStatus(session.id, status);
    toast[status === "approved" ? "success" : "info"](
      `${session.displayName} at ${session.tableCode} ${status}`,
    );
    await refresh();
    setBusyId(null);
  }

  async function approveClosure(session: GuestSession) {
    setBusyId(session.id);
    // TODO(backend): closing settles payment and frees the table.
    await guestsService.setSessionStatus(session.id, "closed");
    toast.success(`Tab closed for ${session.displayName} at ${session.tableCode}`);
    await refresh();
    setBusyId(null);
  }

  const pending = (sessions ?? []).filter((s) => s.status === "pending");
  const closures = (sessions ?? []).filter((s) => s.status === "closure-requested");
  const recent = (sessions ?? [])
    .filter((s) => !["pending", "closure-requested"].includes(s.status))
    .slice(0, 6);

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-xl font-semibold">Guest approvals</h1>

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
                    <ConfirmDialog
                      trigger={
                        <Button className="h-11 w-full" disabled={busyId === session.id}>
                          <Check className="size-4" /> Approve & close tab
                        </Button>
                      }
                      title={`Close the tab for ${session.tableCode}?`}
                      description="The session ends and the table frees up. Payment settlement arrives with the backend."
                      confirmLabel="Close tab"
                      onConfirm={() => approveClosure(session)}
                    />
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
    </div>
  );
}
