"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { FloorMapCanvas } from "@/components/shared/floor-map-canvas";
import { isDemoMode } from "@/features/shared/app-mode";
import { LIVE_APP_URL } from "@/features/shared/app-origins";
import { reservationService } from "@/features/hospitality/reservation-service";
import { reservationsKeys } from "@/features/hospitality/query-keys";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import { ZONE_SWATCH } from "@/features/shared/zone-colors";
import type { VenueTable, Zone } from "@/lib/types";
import { z } from "zod";

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
  const locale = useLocale();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const dateParam = searchParams.get("date");
  const eventParam = searchParams.get("event");

  const [date, setDate] = useState(dateParam || tomorrow());
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data, isPending: loading } = useQuery({
    queryKey: reservationsKeys.publicAvailability(venueSlug),
    queryFn: () =>
      reservationService.getPublicAvailability(venueSlug, {
        date,
        eventId: eventParam || undefined,
      }),
    enabled: !submitted,
  });

  const submitMutation = useMutation({
    mutationFn: async (formData: { guestName: string; guestEmail?: string; guestPhone?: string; note?: string; consent: true }) => {
      if (!selectedTable) throw new Error("No table selected");
      await reservationService.createPublicReservation({
        venueSlug,
        tableId: selectedTable.id,
        zoneId: selectedTable.zoneId,
        guestName: formData.guestName.trim(),
        partySize,
        date,
        guestEmail: formData.guestEmail?.trim() || undefined,
        guestPhone: formData.guestPhone?.trim() || undefined,
        note: formData.note?.trim() || undefined,
        eventId: eventParam || undefined,
        consent: formData.consent,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Reservation request sent!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not submit reservation.");
    },
  });

  // Form state
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({
      guestName: z.string().min(1, "Name is required"),
      guestEmail: z.string().default(""),
      guestPhone: z.string().default(""),
      note: z.string().default(""),
      consent: z.literal(true, { message: "You must accept the privacy policy to book" }),
    })),
    defaultValues: { guestName: "", guestEmail: "", guestPhone: "", note: "", consent: false as unknown as true },
  });
  const [partySize, setPartySize] = useState(2);

  const selectedTable = data?.tables.find((t) => t.id === selectedTableId) ?? null;

  function handleSelectTable(table: VenueTable) {
    const pub = data?.tables.find((t) => t.id === table.id);
    if (!pub?.available) return;
    setSelectedTableId((prev) => (prev === table.id ? null : table.id));
  }

  const onSubmit = handleSubmit(async (formData) => {
    submitMutation.mutate(formData);
  });

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
          <h1 className="text-display text-2xl">Request received!</h1>
          <p className="max-w-sm text-muted-foreground">
            {data.venue.name} will review your reservation for{" "}
            {new Date(date + "T12:00:00").toLocaleDateString(
              locale === "fr" ? "fr-CA" : "en-CA",
              {
                weekday: "long",
                month: "long",
                day: "numeric",
              },
            )}
            . You&apos;ll receive a confirmation with your table PIN.
          </p>
        </div>
          <Button
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            setSelectedTableId(null);
            reset({ guestName: "", guestEmail: "", guestPhone: "", note: "" });
            setPartySize(2);
            queryClient.invalidateQueries({ queryKey: reservationsKeys.publicAvailability(venueSlug) });
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
    capacity: null,
  }));

  const aspect = `${data.venue.floorMap.width} / ${data.venue.floorMap.height}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pt-8">
      {/* Header */}
      <div className="text-center">
        <BrandLogo />
        <h1 className="text-display mt-3 text-2xl">{data.venue.name}</h1>
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
                  <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-name">Your name</Label>
                    <Input id="pub-name" placeholder="e.g. Alex Tremblay" {...register("guestName")} />
                    {errors.guestName && <p className="text-xs text-red-600">{errors.guestName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Party size</Label>
                    <div className="flex items-center justify-between rounded-lg border p-2">
                      <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setPartySize((n) => Math.max(1, n - 1))} aria-label="Fewer people">
                        <Minus className="size-4" />
                      </Button>
                      <span className="flex items-center gap-2 font-semibold tabular-nums">
                        <Users className="size-4 text-muted-foreground" /> {partySize}
                      </span>
                      <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setPartySize((n) => Math.min(selectedTable.seats, n + 1))} aria-label="More people">
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your email and phone are used only for reservation confirmation and PIN delivery.{" "}
                      <Link
                        href={isDemoMode() ? `${LIVE_APP_URL}/privacy` : "/privacy"}
                        target="_blank"
                        className="text-primary underline"
                      >
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-email">Email</Label>
                    <Input id="pub-email" type="email" placeholder="you@example.com" {...register("guestEmail")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-phone">Phone (or email above)</Label>
                    <Input id="pub-phone" type="tel" placeholder="+1 514 555 0100" {...register("guestPhone")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pub-note">Note (optional)</Label>
                    <Textarea id="pub-note" rows={2} placeholder="Birthday, special requests…" {...register("note")} />
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      id="pub-consent"
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      {...register("consent")}
                    />
                    <Label htmlFor="pub-consent" className="text-xs font-normal leading-relaxed">
                      I have read and agree to the{" "}
                      <Link
                        href={isDemoMode() ? `${LIVE_APP_URL}/privacy` : "/privacy"}
                        target="_blank"
                        className="text-primary underline"
                      >
                        Privacy Policy
                      </Link>
                      . My details are used only for this reservation and its confirmation.
                    </Label>
                  </div>
                  {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}
                  <Button type="submit" className="w-full" disabled={isSubmitting || submitMutation.isPending || data.nightOpen}>
                    {(isSubmitting || submitMutation.isPending) && <Loader2 className="size-4 animate-spin" />}
                    {isSubmitting || submitMutation.isPending ? "Submitting…" : "Request reservation"}
                  </Button>
                  </form>
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
