"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Code, Link2, Loader2, PartyPopper, Pencil, Plus, Ticket, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, EventActionGold, EventActionChrome } from "@/components/shared/event-card";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { eventsService } from "@/features/hospitality/events-service";
import { venueService } from "@/features/venue/services";
import { eventsKeys } from "@/features/hospitality/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { useAuth } from "@/context/auth-context";
import { publicEventsHref, publicReservationHref } from "@/features/shared/entity-links";
import { DateFilter, isInDateRange, type DateRange } from "@/components/shared/date-filter";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/features/shared/utils";
import { zEventInput } from "@/lib/form-schemas";
import type { EventGuest, EventStatus, VenueEvent, Zone } from "@/lib/types";
import type { z } from "zod";

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

type FormValues = z.infer<typeof zEventInput>;
const EMPTY_VALUES: FormValues = {
  name: "",
  description: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: toLocalInput(new Date(Date.now() + 5 * 3600_000).toISOString()),
  zoneId: "",
  capacity: 50,
  status: "draft" as const,
  guestlistEnabled: false,
  ticketEnabled: false,
  ticketUrl: "",
};

function EventsContent() {
  const t = useTranslations("manager.events");
  const router = useRouter();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"draft" | "published" | "live" | "ended" | "cancelled" | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGuestName, setNewGuestName] = useState("");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(zEventInput),
    defaultValues: EMPTY_VALUES,
  });
  const ticketEnabled = watch("ticketEnabled");

  const { data: events } = useQuery({
    queryKey: eventsKeys.all(venueId),
    queryFn: () => eventsService.listEvents(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: venue } = useQuery({
    queryKey: venueKeys.single(venueId),
    queryFn: () => venueService.getVenue(),
    enabled: !!venueId,
  });

  const { data: guestsByEvent = {} } = useQuery({
    queryKey: eventsKeys.guests(venueId),
    queryFn: async () => {
      const enabledEvents = (events ?? []).filter((e) => e.guestlistEnabled);
      const entries = await Promise.all(
        enabledEvents.map(async (e) => [e.id, await eventsService.listEventGuests(e.id)] as const),
      );
      return Object.fromEntries(entries);
    },
    enabled: !!venueId && !!events,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: eventsKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: eventsKeys.guests(venueId) });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const rawTicketUrl = data.ticketEnabled ? data.ticketUrl.trim() : "";
      const payload = {
        name: data.name.trim(),
        description: data.description.trim(),
        startsAt: fromLocalInput(data.startsAt),
        endsAt: fromLocalInput(data.endsAt),
        zoneId: data.zoneId || undefined,
        capacity: data.capacity,
        status: data.status as EventStatus,
        guestlistEnabled: data.guestlistEnabled,
        ticketUrl: rawTicketUrl || undefined,
      };
      if (editingId) {
        return eventsService.updateEvent(editingId, payload);
      } else {
        return eventsService.createEvent(payload);
      }
    },
    onSuccess: () => {
      setDialogOpen(false);
      toast.success(editingId ? t("eventUpdated") : t("eventCreated"));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ev: VenueEvent) => eventsService.deleteEvent(ev.id),
    onSuccess: (_, ev) => {
      toast.info(t("deleted", { name: ev.name }));
      invalidate();
    },
  });

  const toggleGuestlistMutation = useMutation({
    mutationFn: (ev: VenueEvent) => eventsService.updateEvent(ev.id, { guestlistEnabled: !ev.guestlistEnabled }),
    onSuccess: () => invalidate(),
  });

  const addGuestMutation = useMutation({
    mutationFn: ({ eventId, name }: { eventId: string; name: string }) =>
      eventsService.addEventGuest({ eventId, name, partySize: 1 }),
    onSuccess: () => {
      setNewGuestName("");
      invalidate();
    },
  });

  const removeGuestMutation = useMutation({
    mutationFn: (guestId: string) => eventsService.removeEventGuest(guestId),
    onSuccess: () => invalidate(),
  });

  const onSave = handleSubmit(async (data) => {
    const rawTicketUrl = data.ticketEnabled ? data.ticketUrl.trim() : "";
    if (rawTicketUrl && !/^https?:\/\/.+/.test(rawTicketUrl)) {
      toast.error(t("ticketUrlHttp"));
      return;
    }
    if (data.ticketEnabled && !rawTicketUrl) {
      toast.error(t("ticketUrlRequired"));
      return;
    }
    saveMutation.mutate(data);
  });

  function addGuest(eventId: string) {
    if (!newGuestName.trim()) return;
    addGuestMutation.mutate({ eventId, name: newGuestName.trim() });
  }

  const zoneName = (id?: string) => zones.find((z) => z.id === id)?.name ?? "—";

  function openCreate() {
    setEditingId(null);
    reset({ ...EMPTY_VALUES, zoneId: zones[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(ev: VenueEvent) {
    setEditingId(ev.id);
    const s: FormValues["status"] = ev.status === "live" || ev.status === "ended" ? "published" : ev.status;
    reset({
      name: ev.name,
      description: ev.description,
      startsAt: toLocalInput(ev.startsAt),
      endsAt: toLocalInput(ev.endsAt),
      zoneId: ev.zoneId ?? "",
      capacity: ev.capacity,
      status: s,
      guestlistEnabled: ev.guestlistEnabled,
      ticketEnabled: !!ev.ticketUrl,
      ticketUrl: ev.ticketUrl ?? "",
    });
    setDialogOpen(true);
  }

  const visible = (events ?? []).filter((ev) => {
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (!isInDateRange(ev.startsAt, dateRange)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!`${ev.name} ${ev.description} ${zoneName(ev.zoneId)}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("bookings"), href: "/manager/reservations" }, { label: t("title") }]}
        actions={
          <div className="flex items-center gap-2">
            {venue && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}${publicEventsHref(venue.publicSlug)}`;
                    navigator.clipboard.writeText(url);
                    toast.success(t("copyLinkToast"));
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
                    toast.success(t("embedToast"));
                  }}
                >
                  <Code className="size-4" /> {t("embedReservations")}
                </Button>
              </>
            )}
            <Button onClick={openCreate}>
              <Plus className="size-4" /> {t("newEvent")}
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
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["all", "draft", "published", "live", "ended"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
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

      {events === undefined ? (
        <ListSkeleton rows={3} rowHeight="h-32" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={t("noEventsMatch")}
          description={events.length === 0 ? t("noEventsDesc") : t("adjustFilters")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((ev) => {
            const guests = guestsByEvent[ev.id] ?? [];
            const expanded = openId === ev.id;
            return (
              <EventCard
                key={ev.id}
                event={ev}
                zoneName={zoneName(ev.zoneId)}
                detail={
                  expanded && ev.guestlistEnabled ? (
                    <div className="space-y-2 border-t border-gold/15 pt-2 dark:border-gold/10">
                      <div className="flex gap-2">
                        <Input
                          placeholder={t("addGuestName")}
                          value={newGuestName}
                          onChange={(e) => setNewGuestName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addGuest(ev.id)}
                        />
                        <Button size="sm" onClick={() => addGuest(ev.id)}>
                          <UserPlus className="size-3.5" />
                        </Button>
                      </div>
                      {guests.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("noGuests")}</p>
                      ) : (
                        <ul className="space-y-1">
                          {guests.map((g) => (
                            <li key={g.id} className="flex items-center justify-between text-sm">
                              <span>
                                {g.name} <span className="text-xs text-muted-foreground">· {g.partySize}</span>
                              </span>
                              <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-red-600" aria-label={t("removeGuest")} onClick={() => removeGuestMutation.mutate(g.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : undefined
                }
                actions={
                  <>
                    {ev.status !== "draft" && ev.status !== "ended" && (
                      <EventActionGold onClick={() => router.push(`/manager/reservations?newForEvent=${ev.id}`)}>
                        <CalendarCheck className="size-3.5" /> {t("book")}
                      </EventActionGold>
                    )}
                    <EventActionChrome onClick={() => openEdit(ev)}>
                      <Pencil className="size-3.5" /> {t("edit")}
                    </EventActionChrome>
                    <ConfirmDialog
                      trigger={
                        <EventActionChrome destructive>
                          <Trash2 className="size-3.5" /> {t("delete")}
                        </EventActionChrome>
                      }
                      title={t("deleteTitle", { name: ev.name })}
                      description={t("deleteDesc")}
                      confirmLabel={t("deleteConfirm")}
                      destructive
                      onConfirm={() => deleteMutation.mutate(ev)}
                    />
                    {ev.guestlistEnabled && (
                      <EventActionChrome onClick={() => setOpenId(expanded ? null : ev.id)}>
                        <Users className="size-3.5" /> {t("guestlist")} ({guests.length})
                      </EventActionChrome>
                    )}
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t("guestlist")}
                      <Switch checked={ev.guestlistEnabled} onCheckedChange={() => toggleGuestlistMutation.mutate(ev)} />
                    </label>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("editEventTitle") : t("newEventTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-name">{t("nameLabel")}</Label>
              <Input id="ev-name" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">{t("descriptionLabel")}</Label>
              <Textarea id="ev-desc" rows={2} {...register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">{t("starts")}</Label>
                <Input id="ev-start" type="datetime-local" {...register("startsAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">{t("ends")}</Label>
                <Input id="ev-end" type="datetime-local" {...register("endsAt")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-zone">{t("zoneLabel")}</Label>
                <select id="ev-zone" className={selectCls} value={watch("zoneId")} onChange={(e) => setValue("zoneId", e.target.value)}>
                  <option value="">{t("selectZone")}</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-cap">{t("capacityLabel")}</Label>
                <Input id="ev-cap" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-status">{t("statusLabel")}</Label>
              <select id="ev-status" className={selectCls} value={watch("status")} onChange={(e) => setValue("status", e.target.value as FormValues["status"])}>
                <option value="draft">{t("draft")}</option>
                <option value="published">{t("published")}</option>
                <option value="live">{t("live")}</option>
                <option value="ended">{t("ended")}</option>
              </select>
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              {t("enableGuestlist")}
              <Switch checked={watch("guestlistEnabled")} onCheckedChange={(v) => setValue("guestlistEnabled", v)} />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              {t("sellTickets")}
              <Switch
                checked={ticketEnabled}
                onCheckedChange={(v) => {
                  setValue("ticketEnabled", v);
                  if (!v) setValue("ticketUrl", "");
                }}
                aria-label={t("enableTicketAria")}
              />
            </label>
            {ticketEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="ev-ticket-url" className="flex items-center gap-1.5">
                  <Ticket className="size-3.5" /> {t("ticketUrlLabel")}
                </Label>
                <Input
                  id="ev-ticket-url"
                  type="url"
                  placeholder={t("ticketUrlPlaceholder")}
                  {...register("ticketUrl")}
                />
              </div>
            )}
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? t("saving") : editingId ? t("save") : t("createEvent")}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManagerEventsPage() {
  return (
    <FeatureGate feature="events">
      <Suspense fallback={<ListSkeleton rows={3} rowHeight="h-32" />}>
        <EventsContent />
      </Suspense>
    </FeatureGate>
  );
}
