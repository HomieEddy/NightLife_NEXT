"use client";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Eye, GlassWater, Hand, LifeBuoy, ReceiptEuro, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { guestsService } from "@/features/guests/services";
import { staffService } from "@/features/workforce/staff-service";
import { helpRequestKeys } from "@/features/guests/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { getHelpScope } from "@/features/shared/role-capabilities";
import { timeAgo } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import { useLiveEvents } from "@/lib/use-live-events";
import { useAuth } from "@/context/auth-context";
import type { HelpRequest, HelpRequestType, StaffMember } from "@/lib/types";

const TYPE_META: Record<HelpRequestType, { label: string; icon: typeof Hand; urgent?: boolean }> = {
  "call-waiter": { label: "Call waiter", icon: Hand },
  "refill-ice": { label: "Refill ice & mixers", icon: GlassWater },
  "clean-table": { label: "Clean table", icon: Sparkles },
  bill: { label: "Bill requested", icon: ReceiptEuro },
  security: { label: "Security", icon: Shield, urgent: true },
};

function scopeFilter(requests: HelpRequest[], me: StaffMember): HelpRequest[] {
  const scope = getHelpScope(me.role);
  if (scope === "all") return requests;
  if (scope === "security-only") return requests.filter((r) => r.type === "security");
  // assigned-zones: requests in my zones, minus security-type (security handles those)
  return requests.filter(
    (r) => r.type !== "security" && me.assignedZoneIds.includes(r.zoneId),
  );
}

export default function StaffHelpPage() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: helpRequestKeys.all(venueId) });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: helpRequestKeys.all(venueId),
    queryFn: () => guestsService.listHelpRequests(),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  useLiveEvents({
    scope: "staff",
    onEvent: invalidate,
    fallbackMs: 8000,
    fallbackRefresh: invalidate,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "acknowledged" | "resolved" }) =>
      guestsService.setHelpRequestStatus(id, status),
    onSuccess: (_, { id: _id, status }) => {
      toast.success(status === "acknowledged" ? "On it" : "Resolved");
      invalidate();
    },
  });

  const isLoading = requestsLoading && !requests;
  const scoped = me ? scopeFilter(requests ?? [], me) : (requests ?? []);
  const open = scoped.filter((r) => r.status !== "resolved");
  const resolved = scoped.filter((r) => r.status === "resolved").slice(0, 5);
  const isSecurityRole = me?.role === "security";

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <h1 className="text-display text-xl">
        {isSecurityRole ? "Security requests" : "Help requests"}
      </h1>

      {isLoading ? (
        <ListSkeleton rows={3} rowHeight="h-28" />
      ) : open.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={isSecurityRole ? "No active security requests" : "All guests are happy"}
          description="Guest help requests appear here. Respond to claim and assist."
        />
      ) : (
        <div className="stagger-children space-y-3">
          {open.map((request) => {
            const meta = TYPE_META[request.type];
            const isBusy =
              setStatusMutation.isPending &&
              setStatusMutation.variables?.id === request.id;
            return (
              <Card
                key={request.id}
                className={cn("py-4", meta.urgent && "border-red-500/40")}
              >
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-lg",
                          meta.urgent ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-primary/15 text-primary",
                        )}
                      >
                        <meta.icon className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.tableCode} · {request.zoneName} · {request.guestName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={request.status} pulse={request.status === "open"} />
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(request.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {request.status === "open" && (
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="outline"
                            className="h-11 flex-1"
                            disabled={isBusy}
                          >
                            <Eye className="size-4" /> On it
                          </Button>
                        }
                        title={`Take "${meta.label}" at ${request.tableCode}?`}
                        description="The guest sees that someone is on the way."
                        confirmLabel="I'm on it"
                        onConfirm={() =>
                          setStatusMutation.mutate({ id: request.id, status: "acknowledged" })
                        }
                      />
                    )}
                    <ConfirmDialog
                      trigger={
                        <Button className="h-11 flex-1" disabled={isBusy}>
                          <CheckCircle2 className="size-4" /> Resolve
                        </Button>
                      }
                      title={`Resolve "${meta.label}" at ${request.tableCode}?`}
                      description="The request is closed and leaves the open queue."
                      confirmLabel="Resolve"
                      onConfirm={() =>
                        setStatusMutation.mutate({ id: request.id, status: "resolved" })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recently resolved</h2>
          {resolved.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between rounded-xl border p-3 opacity-70"
            >
              <p className="text-sm">
                {TYPE_META[request.type].label} · {request.tableCode}
              </p>
              <span className="text-xs text-muted-foreground">{timeAgo(request.createdAt)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
