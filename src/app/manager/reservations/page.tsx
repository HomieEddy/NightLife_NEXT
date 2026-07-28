"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  Code,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReservationFormDialog, type ReservationDraft, EMPTY_DRAFT, toLocalInput, fromLocalInput } from "@/components/shared/reservation-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WaitlistPanel } from "@/components/manager/waitlist-panel";
import { eventsService } from "@/lib/services/events-service";
import { reservationService } from "@/lib/services/reservation-service";
import { staffService } from "@/lib/services/staff-service";
import { venueService } from "@/lib/services/venue-service";
import { isDemoMode } from "@/features/shared/app-mode";
import { publicReservationHref } from "@/features/shared/entity-links";
import { formatTime } from "@/features/shared/format";
import { DateFilter, isInDateRange, type DateRange } from "@/components/shared/date-filter";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination, paginate } from "@/components/shared/pagination";
import { cn } from "@/features/shared/utils";
import type { Reservation, ReservationStatus, StaffMember, Venue, VenueEvent, VenueTable, Zone } from "@/lib/types";

const CHANNEL_LABEL: Record<string, string> = {
  embed: "Embed",
  direct: "Direct",
  "walk-in": "Walk-in",
  promoter: "Promoter",
};

const CHANNEL_CLS: Record<string, string> = {
  embed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  direct: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "walk-in": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  promoter: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_ACTIONS: Record<ReservationStatus, string> = {
  requested: "Confirm",
  confirmed: "Seat",
  seated: "Complete",
  cancelled: "—",
  completed: "—",
  "no-show": "—",
};

function ReservationsContent() {
  const searchParams = useSearchParams();
  const newForEventHandled = useRef(false);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [promoters, setPromoters] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReservationDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const [list, z, t, v, allStaff, allEvents] = await Promise.all([
      reservationService.listReservations(),
      venueService.listZones(),
      venueService.listTables(),
      venueService.getVenue(),
      staffService.listStaff(),
      eventsService.listEvents(),
    ]);
    setReservations(list);
    setZones(z);
    setTables(t);
    setVenue(v);
    setPromoters(allStaff.filter((s) => s.role === "promoter"));
    setEvents(allEvents.filter((e) => e.status !== "draft"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    window.history.replaceState(null, "", "/manager/reservations");
  }, [searchParams, events, zones]);

  const zoneName = (id?: string) => zones.find((z) => z.id === id)?.name ?? "—";
  const tableName = (id?: string) => tables.find((t) => t.id === id)?.code ?? "—";
  const eventName = (id?: string) => events.find((e) => e.id === id)?.name;

  const tablesForZone = useMemo(
    () => (draft.zoneId ? tables.filter((t) => t.zoneId === draft.zoneId) : tables),
    [draft.zoneId, tables],
  );

  async function advance(res: Reservation) {
    const next = STATUS_ACTIONS[res.status];
    if (next === "—") return;
    await reservationService.setStatus(res.id, res.status === "requested" ? "confirmed" : res.status === "confirmed" ? "seated" : "completed");
    toast.success(`${res.guestName}'s reservation ${next.toLowerCase()}ed`);
    await refresh();
  }

  function openCreate() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, zoneId: zones[0]?.id ?? "", tableId: "" });
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
      promoterId: res.promoterId,
      eventId: res.eventId,
      guestProfileId: res.guestProfileId,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.guestName.trim()) return toast.error("Guest name is required.");
    if (!draft.zoneId) return toast.error("Pick a zone.");
    setSaving(true);
    const payload = {
      zoneId: draft.zoneId,
      tableId: draft.tableId || undefined,
      guestName: draft.guestName,
      partySize: draft.partySize,
      startsAt: fromLocalInput(draft.startsAt),
      endsAt: draft.endsAt ? fromLocalInput(draft.endsAt) : undefined,
      note: draft.note,
      source: "manager" as const,
      promoterId: draft.promoterId,
      eventId: draft.eventId,
      guestProfileId: draft.guestProfileId,
      ...(draft.promoterId ? { channel: "promoter" as const } : {}),
    };
    if (editingId) {
      await reservationService.updateReservation(editingId, payload);
      toast.success("Reservation updated");
    } else {
      await reservationService.createReservation(payload);
      toast.success("Reservation created");
    }
    setSaving(false);
    setDialogOpen(false);
    await refresh();
  }

  async function remove(res: Reservation) {
    await reservationService.cancelReservation(res.id);
    toast.info(`${res.guestName}'s reservation cancelled`);
    await refresh();
  }

  async function noShow(res: Reservation) {
    try {
      await reservationService.markNoShow(res.id);
      toast.info(`${res.guestName} marked as no-show`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark as no-show");
    }
  }

  const visible =
    reservations?.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (zoneFilter !== "all" && r.zoneId !== zoneFilter) return false;
      if (!isInDateRange(r.startsAt, dateRange)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!`${r.guestName} ${zoneName(r.zoneId)} ${tableName(r.tableId)}`.toLowerCase().includes(q)) return false;
      }
      return true;
    }) ?? null;

  const initialTab = searchParams.get("tab") === "waitlist" ? "waitlist" : "reservations";

  return (
    <div className="space-y-5">
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="waitlist" className="pt-4">
          <WaitlistPanel />
        </TabsContent>

        <TabsContent value="reservations" className="space-y-5 pt-4">
      <PageHeader
        title="Reservations"
        description="Table bookings and guest lists for the night."
        actions={
          <div className="flex items-center gap-2">
            {venue && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}${publicReservationHref(venue.publicSlug)}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Reservation link copied");
                  }}
                >
                  <Link2 className="size-4" /> Copy link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}${publicReservationHref(venue.publicSlug)}`;
                    const snippet = `<iframe src="${url}" width="100%" height="700" frameborder="0"></iframe>`;
                    navigator.clipboard.writeText(snippet);
                    toast.success("Embed snippet copied");
                  }}
                >
                  <Code className="size-4" /> Embed
                </Button>
              </>
            )}
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New reservation
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by guest or zone…"
            className="w-full sm:w-56"
          />
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className={cn(selectCls, "w-40")}
          >
            <option value="all">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["all", "requested", "confirmed", "seated", "completed", "cancelled", "no-show"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {visible === null ? (
        <ListSkeleton rows={4} rowHeight="h-24" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No reservations"
          description="Create a booking to hold a table for guests."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {paginate(visible, page).map((res) => (
            <Card key={res.id} className="py-4">
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{res.guestName}</p>
                    <p className="text-xs text-muted-foreground">
                      {zoneName(res.zoneId)} · {tableName(res.tableId)} · {res.partySize} guests
                    </p>
                    {res.eventId && eventName(res.eventId) && (
                      <p className="flex items-center gap-1 text-xs text-primary">
                        <CalendarDays className="size-3" /> {eventName(res.eventId)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {res.channel && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CHANNEL_CLS[res.channel] ?? "bg-muted text-muted-foreground")}>
                        {CHANNEL_LABEL[res.channel] ?? res.channel}
                      </span>
                    )}
                    <StatusBadge status={res.status} />
                  </div>
                </div>
                <p className="text-sm">
                  {new Date(res.startsAt).toLocaleDateString()} · {formatTime(res.startsAt)}
                </p>
                {res.note && <p className="text-xs text-muted-foreground">{res.note}</p>}
                {res.guestEmail && <p className="text-xs text-muted-foreground">{res.guestEmail}</p>}
                {res.guestPhone && <p className="text-xs text-muted-foreground">{res.guestPhone}</p>}
                {isDemoMode() && res.reservationPin && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <KeyRound className="size-3 text-amber-600 dark:text-amber-400" />
                    <span className="font-mono tracking-widest">{res.reservationPin}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(res.reservationPin!);
                        toast.success("PIN copied");
                      }}
                      aria-label="Copy PIN"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                  {STATUS_ACTIONS[res.status] !== "—" && (
                    <Button size="sm" variant="default" onClick={() => advance(res)}>
                      <Check className="size-3.5" /> {STATUS_ACTIONS[res.status]}
                    </Button>
                  )}
                  {res.status === "confirmed" && (
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400">
                          <UserX className="size-3.5" /> No-show
                        </Button>
                      }
                      title={`Mark ${res.guestName} as no-show?`}
                      description="They were confirmed but never arrived. The table is released and this counts against the no-show rate."
                      confirmLabel="Mark no-show"
                      destructive
                      onConfirm={() => noShow(res)}
                    />
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(res)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 className="size-3.5" /> Cancel
                      </Button>
                    }
                    title={`Cancel ${res.guestName}'s reservation?`}
                    description="The table is released back to open."
                    confirmLabel="Cancel reservation"
                    destructive
                    onConfirm={() => remove(res)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination totalItems={visible?.length ?? 0} currentPage={page} onPageChange={setPage} className="mt-3" />

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
        promoters={promoters}
        events={events}
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="size-3.5" /> Prototype note: confirming a reservation marks its table
        as reserved on the floor map.
      </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ManagerReservationsPage() {
  return (
    <FeatureGate feature="reservations">
      <Suspense fallback={<ListSkeleton rows={4} rowHeight="h-24" />}>
        <ReservationsContent />
      </Suspense>
    </FeatureGate>
  );
}
