"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2, PartyPopper, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { eventsService } from "@/lib/services/events-service";
import { venueService } from "@/lib/services/venue-service";
import { DateFilter, isInDateRange, type DateRange } from "@/components/shared/date-filter";
import { DateRangePicker, isInCustomDateRange, type DateRangeValue } from "@/components/shared/date-range-picker";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import type { EventGuest, EventStatus, VenueEvent, Zone } from "@/lib/types";

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

type EventDraft = {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  zoneId: string;
  capacity: number;
  status: EventStatus;
  guestlistEnabled: boolean;
};

const EMPTY_DRAFT: EventDraft = {
  name: "",
  description: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: toLocalInput(new Date(Date.now() + 5 * 3600_000).toISOString()),
  zoneId: "",
  capacity: 50,
  status: "draft",
  guestlistEnabled: false,
};

function EventsContent() {
  const [events, setEvents] = useState<VenueEvent[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [guestsByEvent, setGuestsByEvent] = useState<Record<string, EventGuest[]>>({});
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [customRange, setCustomRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");

  const refresh = useCallback(async () => {
    const [list, z] = await Promise.all([
      eventsService.listEvents(),
      venueService.listZones(),
    ]);
    setEvents(list);
    setZones(z);
    const entries = await Promise.all(
      list.filter((e) => e.guestlistEnabled).map(async (e) => [e.id, await eventsService.listEventGuests(e.id)] as const),
    );
    setGuestsByEvent(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const zoneName = (id?: string) => zones.find((z) => z.id === id)?.name ?? "—";

  function openCreate() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, zoneId: zones[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(ev: VenueEvent) {
    setEditingId(ev.id);
    setDraft({
      name: ev.name,
      description: ev.description,
      startsAt: toLocalInput(ev.startsAt),
      endsAt: toLocalInput(ev.endsAt),
      zoneId: ev.zoneId ?? "",
      capacity: ev.capacity,
      status: ev.status,
      guestlistEnabled: ev.guestlistEnabled,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) return toast.error("Event name is required.");
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      startsAt: fromLocalInput(draft.startsAt),
      endsAt: fromLocalInput(draft.endsAt),
      zoneId: draft.zoneId || undefined,
      capacity: draft.capacity,
      status: draft.status,
      guestlistEnabled: draft.guestlistEnabled,
    };
    if (editingId) {
      await eventsService.updateEvent(editingId, payload);
      toast.success("Event updated");
    } else {
      await eventsService.createEvent(payload);
      toast.success("Event created");
    }
    setSaving(false);
    setDialogOpen(false);
    await refresh();
  }

  async function remove(ev: VenueEvent) {
    await eventsService.deleteEvent(ev.id);
    toast.info(`${ev.name} deleted`);
    await refresh();
  }

  async function toggleGuestlist(ev: VenueEvent) {
    await eventsService.updateEvent(ev.id, { guestlistEnabled: !ev.guestlistEnabled });
    await refresh();
  }

  async function addGuest(eventId: string) {
    if (!newGuestName.trim()) return;
    await eventsService.addEventGuest({ eventId, name: newGuestName, partySize: 1 });
    setNewGuestName("");
    await refresh();
  }

  async function removeGuest(guestId: string) {
    await eventsService.removeEventGuest(guestId);
    await refresh();
  }

  const visible = (events ?? []).filter((ev) => {
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (!isInDateRange(ev.startsAt, dateRange)) return false;
    if ((customRange.from || customRange.to) && !isInCustomDateRange(ev.startsAt, customRange)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!`${ev.name} ${ev.description} ${zoneName(ev.zoneId)}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        description="Promotions, parties and guestlists for the venue."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New event
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search events…"
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
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <DateFilter value={dateRange} onChange={setDateRange} />
          <div className="h-4 w-px bg-border" />
          <DateRangePicker value={customRange} onChange={setCustomRange} />
        </div>
      </div>

      {events === null ? (
        <ListSkeleton rows={3} rowHeight="h-32" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="No events match"
          description={events.length === 0 ? "Create an event to promote it to guests and build a guestlist." : "Try adjusting the filters."}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((ev) => {
            const guests = guestsByEvent[ev.id] ?? [];
            const expanded = openId === ev.id;
            return (
              <Card key={ev.id} className="py-4">
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {zoneName(ev.zoneId)} · cap {ev.capacity}
                      </p>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                  {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                  <p className="text-sm">
                    {new Date(ev.startsAt).toLocaleDateString()} {new Date(ev.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {new Date(ev.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      }
                      title={`Delete ${ev.name}?`}
                      description="This also removes its guestlist."
                      confirmLabel="Delete event"
                      destructive
                      onConfirm={() => remove(ev)}
                    />
                    {ev.guestlistEnabled && (
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(expanded ? null : ev.id)}>
                        <Users className="size-3.5" /> Guestlist ({guests.length})
                      </Button>
                    )}
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                      Guestlist
                      <Switch checked={ev.guestlistEnabled} onCheckedChange={() => toggleGuestlist(ev)} />
                    </label>
                  </div>

                  {expanded && ev.guestlistEnabled && (
                    <div className="space-y-2 border-t pt-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add guest name…"
                          value={newGuestName}
                          onChange={(e) => setNewGuestName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addGuest(ev.id)}
                        />
                        <Button size="sm" onClick={() => addGuest(ev.id)}>
                          <UserPlus className="size-3.5" />
                        </Button>
                      </div>
                      {guests.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No guests yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {guests.map((g) => (
                            <li key={g.id} className="flex items-center justify-between text-sm">
                              <span>
                                {g.name} <span className="text-xs text-muted-foreground">· {g.partySize}</span>
                              </span>
                              <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-red-600" onClick={() => removeGuest(g.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit event" : "New event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-name">Name</Label>
              <Input id="ev-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea id="ev-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Starts</Label>
                <Input id="ev-start" type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">Ends</Label>
                <Input id="ev-end" type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-zone">Zone</Label>
                <select id="ev-zone" className={selectCls} value={draft.zoneId} onChange={(e) => setDraft({ ...draft, zoneId: e.target.value })}>
                  <option value="">Select zone…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-cap">Capacity</Label>
                <Input id="ev-cap" type="number" min={1} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Math.max(1, Number(e.target.value)) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-status">Status</Label>
              <select id="ev-status" className={selectCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EventStatus })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              Enable guestlist
              <Switch checked={draft.guestlistEnabled} onCheckedChange={(v) => setDraft({ ...draft, guestlistEnabled: v })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Save" : "Create event"}
            </Button>
          </DialogFooter>
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
