"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  Code,
  Copy,
  KeyRound,
  Link2,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { eventsService } from "@/features/hospitality/events-service";
import { reservationService } from "@/features/hospitality/reservation-service";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { isDemoMode } from "@/features/shared/app-mode";
import { publicReservationHref } from "@/features/shared/entity-links";
import { formatTime } from "@/features/shared/format";
import { DateFilter, isInDateRange, type DateRange } from "@/components/shared/date-filter";
import { SearchInput } from "@/components/shared/search-input";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { useAuth } from "@/context/auth-context";
import { reservationsKeys, eventsKeys } from "@/features/hospitality/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { cn } from "@/features/shared/utils";
import type { Reservation, ReservationStatus, StaffMember, VenueEvent, VenueTable, Zone } from "@/lib/types";

const CHANNEL_CLS: Record<string, string> = {
  embed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  direct: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "walk-in": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  promoter: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ReservationsContent() {
  const t = useTranslations("manager.reservations");
  const searchParams = useSearchParams();
  const newForEventHandled = useRef(false);
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const CHANNEL_LABEL: Record<string, string> = {
    embed: t("channelEmbed"),
    direct: t("channelDirect"),
    "walk-in": t("channelWalkIn"),
    promoter: t("channelPromoter"),
  };

  const STATUS_ACTIONS: Record<ReservationStatus, string> = {
    requested: t("statusConfirm"),
    confirmed: t("statusSeat"),
    seated: t("statusComplete"),
    cancelled: t("statusDash"),
    completed: t("statusDash"),
    "no-show": t("statusDash"),
  };

  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReservationDraft>(EMPTY_DRAFT);

  const { data: reservations } = useQuery({
    queryKey: reservationsKeys.all(venueId),
    queryFn: () => reservationService.listReservations(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  const { data: venue } = useQuery({
    queryKey: venueKeys.single(venueId),
    queryFn: () => venueService.getVenue(),
    enabled: !!venueId,
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: eventsKeys.all(venueId),
    queryFn: () => eventsService.listEvents(),
    enabled: !!venueId,
  });

  const promoters = useMemo(
    () => allStaff.filter((s: StaffMember) => s.role === "promoter"),
    [allStaff],
  );
  const events = useMemo(
    () => allEvents.filter((e: VenueEvent) => e.status !== "draft"),
    [allEvents],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: reservationsKeys.all(venueId) });
  };

  const advanceMutation = useMutation({
    mutationFn: (res: Reservation) => {
      const next = res.status === "requested" ? "confirmed" : res.status === "confirmed" ? "seated" : "completed";
      return reservationService.setStatus(res.id, next as ReservationStatus);
    },
    onSuccess: (_, res) => {
      const verb = res.status === "requested" ? t("confirmedVerb") : res.status === "confirmed" ? t("seatedVerb") : t("completedVerb");
      toast.success(t("reservationVerb", { name: res.guestName, verb }));
      invalidate();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
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
        return reservationService.updateReservation(editingId, payload);
      } else {
        return reservationService.createReservation(payload);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? t("updated") : t("created"));
      setDialogOpen(false);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (res: Reservation) => reservationService.cancelReservation(res.id),
    onSuccess: (_, res) => {
      toast.info(t("cancelledToast", { name: res.guestName }));
      invalidate();
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (res: Reservation) => reservationService.markNoShow(res.id),
    onSuccess: (_, res) => {
      toast.info(t("markedNoShow", { name: res.guestName }));
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("couldNotMarkNoShow"));
    },
  });

  useEffect(() => {
    const eventId = searchParams.get("newForEvent");
    if (!eventId || newForEventHandled.current || !events || events.length === 0) return;
    newForEventHandled.current = true;
    const evt = events.find((e: VenueEvent) => e.id === eventId);
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

  const zoneName = (id?: string) => zones.find((z: Zone) => z.id === id)?.name ?? "—";
  const tableName = (id?: string) => tables.find((t: VenueTable) => t.id === id)?.code ?? "—";
  const eventName = (id?: string) => events.find((e: VenueEvent) => e.id === id)?.name;

  const tablesForZone = useMemo(
    () => (draft.zoneId ? tables.filter((t: VenueTable) => t.zoneId === draft.zoneId) : tables),
    [draft.zoneId, tables],
  );

  function advance(res: Reservation) {
    if (STATUS_ACTIONS[res.status] === "—") return;
    advanceMutation.mutate(res);
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

  function save() {
    if (!draft.guestName.trim()) { toast.error(t("guestNameRequired")); return; }
    if (!draft.zoneId) { toast.error(t("zoneRequired")); return; }
    saveMutation.mutate();
  }

  const visible =
    reservations?.filter((r: Reservation) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (zoneFilter !== "all" && r.zoneId !== zoneFilter) return false;
      if (!isInDateRange(r.startsAt, dateRange)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!`${r.guestName} ${zoneName(r.zoneId)} ${tableName(r.tableId)}`.toLowerCase().includes(q)) return false;
      }
      return true;
    }) ?? [];

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, statusFilter, zoneFilter, dateRange, reset]);

  const initialTab = searchParams.get("tab") === "waitlist" ? "waitlist" : "reservations";

  return (
    <div className="space-y-5">
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="reservations">{t("tabReservations")}</TabsTrigger>
          <TabsTrigger value="waitlist">{t("tabWaitlist")}</TabsTrigger>
        </TabsList>

        <TabsContent value="waitlist" className="pt-4">
          <WaitlistPanel />
        </TabsContent>

        <TabsContent value="reservations" className="space-y-5 pt-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("breadcrumbBookings"), href: "/manager/events" }, { label: t("breadcrumbReservations") }]}
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
                    toast.success(t("linkCopied"));
                  }}
                >
                  <Link2 className="size-4" /> {t("copyLink")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}${publicReservationHref(venue.publicSlug)}`;
                    const snippet = `<iframe src="${url}" width="100%" height="700" frameborder="0"></iframe>`;
                    navigator.clipboard.writeText(snippet);
                    toast.success(t("embedSnippetCopied"));
                  }}
                >
                  <Code className="size-4" /> {t("embed")}
                </Button>
              </>
            )}
            <Button onClick={openCreate}>
              <Plus className="size-4" /> {t("newReservation")}
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("searchPlaceholder")}
            className="w-full sm:w-56"
          />
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className={cn(selectCls, "w-40")}
          >
            <option value="all">{t("allZones")}</option>
            {zones.map((z: Zone) => (
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
                {s === "all" ? t("all") : t(s)}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {reservations === undefined ? (
        <ListSkeleton rows={4} rowHeight="h-24" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("noReservations")}
          description={t("noReservationsDesc")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sliced.map((res: Reservation) => (
            <Card key={res.id} className="py-4">
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{res.guestName}</p>
                    <p className="text-xs text-muted-foreground">
                      {zoneName(res.zoneId)} · {tableName(res.tableId)} · {t("guestsCount", { count: res.partySize })}
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
                        toast.success(t("pinCopied"));
                      }}
                      aria-label={t("copyPinAria")}
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
                          <UserX className="size-3.5" /> {t("noShowAction")}
                        </Button>
                      }
                      title={t("markNoShowTitle", { name: res.guestName })}
                      description={t("markNoShowDesc")}
                      confirmLabel={t("markNoShow")}
                      destructive
                      onConfirm={() => noShowMutation.mutate(res)}
                    />
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(res)}>
                    <Pencil className="size-3.5" /> {t("edit")}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 className="size-3.5" /> {t("cancel")}
                      </Button>
                    }
                    title={t("cancelTitle", { name: res.guestName })}
                    description={t("cancelDesc")}
                    confirmLabel={t("cancelReservation")}
                    destructive
                    onConfirm={() => removeMutation.mutate(res)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />

      <ReservationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        setDraft={setDraft}
        zones={zones}
        tablesForZone={tablesForZone}
        onSave={save}
        editingId={editingId}
        promoters={promoters}
        events={events}
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="size-3.5" /> {t("prototypeNote")}
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
