"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MapPin, Minus, Plus, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { ClubLights } from "@/components/fx/club-lights";
import { useGuest } from "@/context/guest-context";
import { guestsService } from "@/lib/services/guests-service";
import { venueService } from "@/lib/services/venue-service";
import type { Venue, VenueTable, Zone } from "@/lib/types";

/**
 * QR entry simulation: in production the guest lands here by scanning the
 * QR code printed on the table. TODO(backend): validate a signed QR token.
 */
export default function QrEntryPage({
  params,
}: {
  params: Promise<{ tableCode: string }>;
}) {
  const { tableCode } = use(params);
  const router = useRouter();
  const { startSession } = useGuest();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ table: VenueTable; zone: Zone; venue: Venue } | null>(null);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    venueService.getTableBySlug(tableCode).then((res) => {
      if (!cancelled) {
        setResult(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tableCode]);

  async function handleJoin() {
    if (!result) return;
    if (!name.trim()) {
      setError("Tell us your first name so staff know who to look for.");
      return;
    }
    setJoining(true);
    const session = await guestsService.requestSession({
      tableId: result.table.id,
      tableCode: result.table.code,
      zoneName: result.zone.name,
      displayName: `${name.trim()} + ${partySize - 1}`,
      partySize,
    });
    startSession(
      {
        tableId: result.table.id,
        tableCode: result.table.code,
        tableLabel: result.table.label,
        zoneId: result.zone.id,
        zoneName: result.zone.name,
      },
      result.venue,
      name.trim(),
      session.id,
    );
    router.push("/guest/waiting");
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <Skeleton className="size-16 rounded-2xl" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full max-w-sm rounded-xl" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={QrCode}
          title="Table not found"
          description={`No table matches the code "${tableCode}". Try the demo table instead.`}
          action={
            <Button asChild>
              <Link href="/g/demo-table">Open demo table</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden p-6">
      <ClubLights density={180} speed={0.8} className="opacity-60" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(360px 240px at 50% 0%, oklch(0.62 0.24 300 / 18%), transparent)",
        }}
      />
      <div className="relative flex justify-center pt-6 animate-pop-in">
        <BrandLogo />
      </div>

      <div className="relative mt-8 text-center animate-fade-up">
        <p className="text-sm text-muted-foreground">Welcome to</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{result.venue.name}</h1>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary">
          <MapPin className="size-3.5" />
          {result.table.code} · {result.zone.name}
        </div>
      </div>

      <Card className="relative mt-8 animate-fade-up bg-card/80 backdrop-blur" style={{ animationDelay: "120ms" }}>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">Your first name</Label>
            <Input
              id="guest-name"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="h-12 text-base"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Party size</Label>
            <div className="flex items-center justify-between rounded-lg border p-2">
              <Button
                variant="outline"
                size="icon"
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
                onClick={() => setPartySize((n) => Math.min(result.table.seats, n + 1))}
                aria-label="More people"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This table seats up to {result.table.seats}.
            </p>
          </div>

          <Button size="lg" className="h-12 w-full glow-primary" onClick={handleJoin} disabled={joining}>
            {joining && <Loader2 className="size-4 animate-spin" />}
            {joining ? "Requesting…" : "Join this table"}
          </Button>
        </CardContent>
      </Card>

      <p className="relative mt-6 text-center text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: "240ms" }}>
        A host will approve your table before you can order.
      </p>
    </div>
  );
}
