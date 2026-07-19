"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { reservationService } from "@/lib/services/reservation-service";
import { venueService } from "@/lib/services/venue-service";
import { formatTime } from "@/lib/format";
import { DateFilter, isInDateRange, type DateRange } from "@/components/shared/date-filter";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import type { Reservation, ReservationStatus, VenueTable, Zone } from "@/lib/types";

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_ACTIONS: Record<ReservationStatus, string> = {
  requested: "Confirm",
  confirmed: "Seat",
  seated: "Complete",
  cancelled: "—",
  completed: "—",
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

type ReservationDraft = {
  guestName: string;
  partySize: number;
  zoneId: string;
  tableId: string;
  startsAt: string; // local input string
  endsAt: string;
  note: string;
};

const EMPTY_DRAFT: ReservationDraft = {
  guestName: "",
  partySize: 2,
  zoneId: "",
  tableId: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: "",
  note: "",
};

function ReservationsContent() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReservationDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [list, z, t] = await Promise.all([
      reservationService.listReservations(),
      venueService.listZones(),
      venueService.listTables(),
    ]);
    setReservations(list);
    setZones(z);
    setTables(t);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const zoneName = (id?: string) => zones.find((z) => z.id === id)?.name ?? "—";
  const tableName = (id?: string) => tables.find((t) => t.id === id)?.code ?? "—";

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reservations"
        description="Table bookings and guest lists for the night."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New reservation
          </Button>
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
            {(["all", "requested", "confirmed", "seated", "completed", "cancelled"] as const).map((s) => (
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
          {visible.map((res) => (
            <Card key={res.id} className="py-4">
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{res.guestName}</p>
                    <p className="text-xs text-muted-foreground">
                      {zoneName(res.zoneId)} · {tableName(res.tableId)} · {res.partySize} guests
                    </p>
                  </div>
                  <StatusBadge status={res.status} />
                </div>
                <p className="text-sm">
                  {new Date(res.startsAt).toLocaleDateString()} · {formatTime(res.startsAt)}
                </p>
                {res.note && <p className="text-xs text-muted-foreground">{res.note}</p>}
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                  {STATUS_ACTIONS[res.status] !== "—" && (
                    <Button size="sm" variant="default" onClick={() => advance(res)}>
                      <Check className="size-3.5" /> {STATUS_ACTIONS[res.status]}
                    </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit reservation" : "New reservation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-name">Guest name</Label>
              <Input
                id="res-name"
                value={draft.guestName}
                onChange={(e) => setDraft({ ...draft, guestName: e.target.value })}
                placeholder="e.g. Jean Dupont"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="res-party">Party size</Label>
                <Input
                  id="res-party"
                  type="number"
                  min={1}
                  value={draft.partySize}
                  onChange={(e) => setDraft({ ...draft, partySize: Math.max(1, Number(e.target.value)) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-zone">Zone</Label>
                <select
                  id="res-zone"
                  className={selectCls}
                  value={draft.zoneId}
                  onChange={(e) => setDraft({ ...draft, zoneId: e.target.value, tableId: "" })}
                >
                  <option value="">Select zone…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-table">Table (optional)</Label>
              <select
                id="res-table"
                className={selectCls}
                value={draft.tableId}
                onChange={(e) => setDraft({ ...draft, tableId: e.target.value })}
              >
                <option value="">No specific table</option>
                {tablesForZone.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="res-start">Starts</Label>
                <Input
                  id="res-start"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-end">Ends (optional)</Label>
                <Input
                  id="res-end"
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-note">Note</Label>
              <Textarea
                id="res-note"
                rows={2}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="Birthday, VIP client, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Save" : "Create reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="size-3.5" /> Prototype note: confirming a reservation marks its table
        as reserved on the floor map.
      </p>
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
