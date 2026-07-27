"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  DollarSign,
  Loader2,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { FloorMapCanvas } from "@/components/shared/floor-map-canvas";
import { reservationService } from "@/lib/services/reservation-service";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ZONE_SWATCH } from "@/lib/zone-colors";
import type { PublicAvailability, PublicTableAvailability } from "@/lib/services/reservation-service";
import type { VenueTable, Zone } from "@/lib/types";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PublicReservationPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = use(params);
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl space-y-6 p-4 pt-10">
          <Skeleton className="mx-auto h-8 w-48" />
          <Skeleton className="aspect-video w-full rounded-xl" />
        </div>
      }
    >
      <ReservationContent venueSlug={venueSlug} />
    </Suspense>
  );
}

function ReservationContent({ venueSlug }: { venueSlug: string }) {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const eventParam = searchParams.get("event");

  const [date, setDate] = useState(dateParam || tomorrow());
  const [data, setData] = useState<PublicAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await reservationService.getPublicAvailability(venueSlug, {
        date,
        eventId: eventParam || undefined,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [venueSlug, date, eventParam]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedTable = data?.tables.find((t) => t.id === selectedTableId) ?? null;

  function handleSelectTable(table: VenueTable) {
    const pub = data?.tables.find((t) => t.id === table.id);
    if (!pub?.available) return;
    setSelectedTableId((prev) => (prev === table.id ? null : table.id));
  }

  async function handleSubmit() {
    if (!data || !selectedTable) return;
    if (!guestName.trim()) return toast.error("Your name is required.");
    if (!guestEmail.trim() && !guestPhone.trim()) return toast.error("Email or phone number is required.");

    setSaving(true);
    try {
      await reservationService.createPublicReservation({
        venueSlug,
        tableId: selectedTable.id,
        zoneId: selectedTable.zoneId,
        guestName: guestName.trim(),
        partySize,
        date,
        guestEmail: guestEmail.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        note: note.trim() || undefined,
        eventId: eventParam || undefined,
      });
      setSubmitted(true);
      toast.success("Reservation request sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit reservation.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 pt-10">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={CalendarDays}
          title="Venue not found"
          description="This reservation link may be invalid or the venue is no longer available."
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Request received!</h1>
          <p className="max-w-sm text-muted-foreground">
            {data.venue.name} will review your reservation for{" "}
            {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            . You&apos;ll receive a confirmation with your table PIN.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            setSelectedTableId(null);
            setGuestName("");
            setPartySize(2);
            setGuestEmail("");
            setGuestPhone("");
            setNote("");
            refresh();
          }}
        >
          Make another reservation
        </Button>
      </div>
    );
  }

  // Convert PublicTableAvailability to VenueTable shape for FloorMapCanvas
  const canvasTables: VenueTable[] = data.tables.map((t) => ({
    id: t.id,
    zoneId: t.zoneId,
    code: t.code,
    label: t.label,
    seats: t.seats,
    minimumSpend: t.minimumSpend,
    status: t.available ? "open" : "reserved",
    qrSlug: "",
    mapX: t.mapX,
    mapY: t.mapY,
  }));

  const canvasZones: Zone[] = data.zones.map((z) => ({
    id: z.id,
    venueId: data.venue.id,
    name: z.name,
    description: "",
    color: z.color,
    tableCount: 0,
  }));

  const aspect = `${data.venue.floorMap.width} / ${data.venue.floorMap.height}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pt-8">
      {/* Header */}
      <div className="text-center">
        <BrandLogo />
        <h1 className="mt-3 text-2xl font-bold">{data.venue.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reserve your table</p>
      </div>

      {/* Date picker */}
      <div className="flex items-center justify-center gap-3">
        <Label htmlFor="res-date" className="text-sm font-medium">
          <CalendarDays className="mr-1.5 inline size-4" />
          Night of
        </Label>
        <Input
          id="res-date"
          type="date"
          value={date}
          min={tomorrow()}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedTableId(null);
          }}
          className="w-auto"
        />
      </div>

      {data.nightOpen && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="px-4 py-3 text-center text-sm text-amber-700 dark:text-amber-300">
            Reservations for tonight are closed — the venue is already open.
            {!dateParam && " Showing availability for tomorrow."}
          </CardContent>
        </Card>
      )}

      {/* Floor map + side panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <FloorMapCanvas
            tables={canvasTables}
            zones={canvasZones}
            aspectRatio={aspect}
            selectedId={selectedTableId}
            readonly
            onSelectTable={handleSelectTable}
            nodeClassName={(table) => {
              const pub = data.tables.find((t) => t.id === table.id);
              if (!pub?.available) return "opacity-40 cursor-not-allowed";
              return undefined;
            }}
            nodeContent={(table) => {
              const pub = data.tables.find((t) => t.id === table.id);
              if (!pub || !pub.available || pub.minimumSpend === null) return null;
              return (
                <span className="text-[8px] font-normal opacity-70">
                  {formatMoney(pub.minimumSpend, data.venue.currency)}
                </span>
              );
            }}
          />
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500/60" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500/60" /> Reserved
            </span>
            {data.zones.map((z) => (
              <span key={z.id} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", ZONE_SWATCH[z.color] ?? "bg-muted-foreground")} />
                {z.name}
              </span>
            ))}
          </div>
        </div>

        {/* Side panel: selected table details + form */}
        <div className="space-y-3">
          {selectedTable ? (
            <>
              <Card className="py-4">
                <CardContent className="space-y-2 px-4">
                  <p className="font-mono text-sm font-semibold">{selectedTable.code}</p>
                  <p className="text-sm text-muted-foreground">{selectedTable.label}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" /> {selectedTable.seats} seats
                    </span>
                    {selectedTable.minimumSpend !== null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="size-3.5" /> Min {formatMoney(selectedTable.minimumSpend, data.venue.currency)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="py-4">
                <CardContent className="space-y-4 px-4">
                  <p className="text-sm font-semibold">Request reservation</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-name">Your name</Label>
                    <Input
                      id="pub-name"
                      placeholder="e.g. Alex Tremblay"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Party size</Label>
                    <div className="flex items-center justify-between rounded-lg border p-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                        aria-label="Fewer people"
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="flex items-center gap-2 font-semibold tabular-nums">
                        <Users className="size-4 text-muted-foreground" /> {partySize}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => setPartySize((n) => Math.min(selectedTable.seats, n + 1))}
                        aria-label="More people"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-email">Email</Label>
                    <Input
                      id="pub-email"
                      type="email"
                      placeholder="you@example.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-phone">Phone (or email above)</Label>
                    <Input
                      id="pub-phone"
                      type="tel"
                      placeholder="+1 514 555 0100"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-note">Note (optional)</Label>
                    <Textarea
                      id="pub-note"
                      rows={2}
                      placeholder="Birthday, special requests…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={saving || data.nightOpen}
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {saving ? "Submitting…" : "Request reservation"}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="py-4">
              <CardContent className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="size-6" />
                Select an available table on the map to reserve it.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
