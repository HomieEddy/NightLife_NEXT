"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, Check, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ReservationFormDialog,
  type ReservationDraft,
  EMPTY_DRAFT,
  toLocalInput,
  fromLocalInput,
} from "@/components/shared/reservation-form-dialog";
import { eventsService } from "@/features/hospitality/events-service";
import { reservationService } from "@/features/hospitality/reservation-service";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { usePermissions } from "@/features/platform/use-permissions";
import { eventsKeys, reservationsKeys } from "@/features/hospitality/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { useAuth } from "@/context/auth-context";
import { formatTime } from "@/features/shared/format";
import { useLiveEvents } from "@/lib/use-live-events";
import type { Reservation, VenueEvent } from "@/lib/types";

const NIGHT_LABELS: Record<string, string> = {};
function nightLabel(iso: string): string {
  const key = iso.slice(0, 10);
  if (!NIGHT_LABELS[key]) {
    const d = new Date(iso);
    NIGHT_LABELS[key] = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  }
  return NIGHT_LABELS[key];
}

function StaffReservationsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const newForEventHandled = useRef(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ReservationDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: reservationsKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: reservationsKeys.mine(venueId, me?.id ?? "") });
  };

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { can } = usePermissions();

  const { data: zones } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: tables } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  const { data: allEvents } = useQuery({
    queryKey: eventsKeys.all(venueId),
    queryFn: () => eventsService.listEvents(),
    enabled: !!venueId,
  });

  const { data: reservations } = useQuery({
    queryKey: reservationsKeys.mine(venueId, me?.id ?? ""),
    queryFn: () => reservationService.listMyReservations(me!.id),
    enabled: !!venueId && !!me,
  });

  useLiveEvents({
    scope: "staff",
    onEvent: invalidate,
    fallbackMs: 8000,
    fallbackRefresh: invalidate,
  });

  const events = useMemo(
    () => (allEvents ?? []).filter((e) => e.status !== "draft"),
    [allEvents],
  );

  const tablesForZone = useMemo(
    () => (tables ?? []).filter((t) => t.zoneId === draft.zoneId),
    [tables, draft.zoneId],
  );

  useEffect(() => {
    const eventId = searchParams.get("newForEvent");
    if (!eventId || newForEventHandled.current || events.length === 0) return;
    newForEventHandled.current = true;
    const evt = events.find((e) => e.id === eventId);
    if (!evt) return;
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      eventId,
      zoneId: evt.zoneId ?? (zones ?? [])[0]?.id ?? "",
      tableId: "",
      startsAt: toLocalInput(evt.startsAt),
      endsAt: toLocalInput(evt.endsAt),
    });
    setDialogOpen(true);
    window.history.replaceState(null, "", "/staff/reservations");
  }, [searchParams, events, zones]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.guestName.trim()) throw new Error("Guest name is required");
      if (!draft.zoneId) throw new Error("Pick a zone");
      const payload = {
        guestName: draft.guestName,
        partySize: draft.partySize,
        zoneId: draft.zoneId,
        tableId: draft.tableId || undefined,
        startsAt: fromLocalInput(draft.startsAt),
        endsAt: draft.endsAt ? fromLocalInput(draft.endsAt) : undefined,
        note: draft.note || undefined,
        eventId: draft.eventId,
      };
      if (editingId) {
        await reservationService.updateReservation(editingId, payload);
        return "updated";
      } else {
        await reservationService.createReservation({
          ...payload,
          source: "manager",
          channel: "promoter",
          promoterId: me?.id,
        });
        return "created";
      }
    },
    onSuccess: (result) => {
      toast.success(result === "updated" ? "Reservation updated" : "Reservation created");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (res: Reservation) => reservationService.setStatus(res.id, "confirmed"),
    onSuccess: (_, res) => {
      toast.success(`${res.guestName}'s reservation confirmed`);
      invalidate();
    },
    onError: () => toast.error("Failed to confirm"),
  });

  const cancelMutation = useMutation({
    mutationFn: (res: Reservation) => reservationService.cancelReservation(res.id),
    onSuccess: (_, res) => {
      toast.success(`Cancelled reservation for ${res.guestName}`);
      invalidate();
    },
    onError: () => toast.error("Failed to cancel"),
  });

  const isPromoter = me?.role === "promoter";

  function openCreate() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, startsAt: toLocalInput(new Date().toISOString()) });
    setDialogOpen(true);
  }

  function openEdit(res: Reservation) {
    setEditingId(res.id);
    setDraft({
      guestName: res.guestName,
      partySize: res.partySize,
      zoneId: res.zoneId ?? "",
      tableId: res.tableId ?? "",
      startsAt: toLocalInput(res.startsAt),
      endsAt: res.endsAt ? toLocalInput(res.endsAt) : "",
      note: res.note ?? "",
      eventId: res.eventId,
    });
    setDialogOpen(true);
  }

  const grouped = useMemo(() => {
    if (!reservations) return [];
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const key = r.startsAt.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [reservations]);

  if (!reservations || !me) {
    return (
      <div className="animate-fade-in space-y-5 p-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-xl">My Reservations</h1>
          <p className="text-sm text-muted-foreground">
            Tonight&apos;s bookings — who&apos;s coming, which table, what time, any special requests.
          </p>
        </div>
        {isPromoter && can("reservation:create-own") && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" /> New
          </Button>
        )}
      </div>

      {grouped.length === 0 && (
        <EmptyState
          icon={CalendarCheck}
          title="No reservations yet"
          description="Bookings you create or are assigned to show up here, grouped by night."
        />
      )}

      {grouped.map(([dateKey, items]) => (
        <div key={dateKey} className="stagger-children space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {nightLabel(items[0].startsAt)}
          </h2>
          {items.map((res) => {
            const owner = { ownerStaffId: res.promoterId };
            const confirmable = isPromoter && res.status === "requested" && can("reservation:confirm-own", owner);
            const editable = isPromoter && ["requested", "confirmed"].includes(res.status) && can("reservation:edit-own", owner);
            const cancellable = isPromoter && ["requested", "confirmed"].includes(res.status) && can("reservation:cancel-own", owner);
            return (
              <Card key={res.id}>
                <CardContent className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{res.guestName}</span>
                      <StatusBadge status={res.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Party of {res.partySize} · {formatTime(res.startsAt)}
                      {res.note && <> · {res.note}</>}
                    </p>
                    {res.eventId && (() => {
                      const evt = events.find((e: VenueEvent) => e.id === res.eventId);
                      return evt ? (
                        <p className="flex items-center gap-1 text-xs text-primary">
                          <CalendarDays className="size-3" /> {evt.name}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {confirmable && (
                      <ConfirmDialog
                        title={`Confirm ${res.guestName}'s reservation?`}
                        description="The reservation will be marked as confirmed."
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8 text-primary" aria-label="Confirm reservation">
                            <Check className="size-3.5" />
                          </Button>
                        }
                        onConfirm={() => confirmMutation.mutate(res)}
                      />
                    )}
                    {editable && (
                      <TooltipIconButton variant="ghost" className="size-8" onClick={() => openEdit(res)} tooltip="Edit reservation">
                        <Pencil className="size-3.5" />
                      </TooltipIconButton>
                    )}
                    {cancellable && (
                      <ConfirmDialog
                        title={`Cancel ${res.guestName}'s reservation?`}
                        description="This cannot be undone."
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Cancel reservation">
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        onConfirm={() => cancelMutation.mutate(res)}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      <ReservationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        setDraft={setDraft}
        zones={zones ?? []}
        tablesForZone={tablesForZone}
        onSave={() => saveMutation.mutate()}
        editingId={editingId}
        events={events}
      />
    </div>
  );
}

export default function StaffReservationsPage() {
  return (
    <Suspense>
      <StaffReservationsContent />
    </Suspense>
  );
}
