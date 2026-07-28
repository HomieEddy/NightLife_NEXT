"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, CalendarDays, Check, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { eventsService } from "@/lib/services/events-service";
import { reservationService } from "@/lib/services/reservation-service";
import { staffService } from "@/lib/services/staff-service";
import { venueService } from "@/lib/services/venue-service";
import { formatTime } from "@/features/shared/format";
import { canDo } from "@/features/shared/permissions";
import { permissionService } from "@/lib/services/permission-service";
import type { RolePermissions } from "@/features/shared/permissions";
import { useLiveEvents } from "@/lib/use-live-events";
import type { Reservation, StaffMember, VenueEvent, Zone, VenueTable } from "@/lib/types";

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
  const newForEventHandled = useRef(false);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ReservationDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [staff, z, t, allEvents, perms] = await Promise.all([
      staffService.getCurrentStaff(),
      venueService.listZones(),
      venueService.listTables(),
      eventsService.listEvents(),
      permissionService.getRolePermissions("venue-1"),
    ]);
    setMe(staff);
    setPermissions(perms);
    setZones(z);
    setTables(t);
    setEvents(allEvents.filter((e) => e.status !== "draft"));
    const res = await reservationService.listMyReservations(staff.id);
    setReservations(res);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
      zoneId: evt.zoneId ?? zones[0]?.id ?? "",
      tableId: "",
      startsAt: toLocalInput(evt.startsAt),
      endsAt: toLocalInput(evt.endsAt),
    });
    setDialogOpen(true);
    window.history.replaceState(null, "", "/staff/reservations");
  }, [searchParams, events, zones]);

  useLiveEvents({
    scope: "staff",
    onEvent: () => refresh(),
    fallbackMs: 8000,
    fallbackRefresh: () => refresh(),
  });

  const tablesForZone = useMemo(
    () => tables.filter((t) => t.zoneId === draft.zoneId),
    [tables, draft.zoneId],
  );

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

  async function save() {
    if (!draft.guestName.trim()) { toast.error("Guest name is required"); return; }
    if (!draft.zoneId) { toast.error("Pick a zone"); return; }
    setSaving(true);
    try {
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
        toast.success("Reservation updated");
      } else {
        await reservationService.createReservation({
          ...payload,
          source: "manager",
          channel: "promoter",
          promoterId: me?.id,
        });
        toast.success("Reservation created");
      }
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirm(res: Reservation) {
    try {
      await reservationService.setStatus(res.id, "confirmed");
      toast.success(`${res.guestName}'s reservation confirmed`);
      refresh();
    } catch {
      toast.error("Failed to confirm");
    }
  }

  async function remove(res: Reservation) {
    try {
      await reservationService.cancelReservation(res.id);
      toast.success(`Cancelled reservation for ${res.guestName}`);
      refresh();
    } catch {
      toast.error("Failed to cancel");
    }
  }

  // Group by night
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
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My Reservations</h1>
        {isPromoter && permissions && canDo(permissions, "promoter", "reservation:create-own") && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" /> New
          </Button>
        )}
      </div>

      {grouped.length === 0 && (
        <EmptyState icon={CalendarCheck} title="No reservations yet" />
      )}

      {grouped.map(([dateKey, items]) => (
        <div key={dateKey} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {nightLabel(items[0].startsAt)}
          </h2>
          {items.map((res) => {
            const confirmable = isPromoter && !!permissions && res.status === "requested" && canDo(permissions, "promoter", "reservation:confirm-own");
            const editable = isPromoter && !!permissions && ["requested", "confirmed"].includes(res.status) && canDo(permissions, "promoter", "reservation:edit-own");
            const cancellable = isPromoter && !!permissions && ["requested", "confirmed"].includes(res.status) && canDo(permissions, "promoter", "reservation:cancel-own");
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
                      const evt = events.find((e) => e.id === res.eventId);
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
                        onConfirm={() => confirm(res)}
                      />
                    )}
                    {editable && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(res)} aria-label="Edit reservation">
                        <Pencil className="size-3.5" />
                      </Button>
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
                        onConfirm={() => remove(res)}
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
        zones={zones}
        tablesForZone={tablesForZone}
        saving={saving}
        onSave={save}
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
