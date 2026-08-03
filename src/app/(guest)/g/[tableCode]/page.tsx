"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, KeyRound, Loader2, Lock, MapPin, Minus, Plus, QrCode, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoOpenTableAction } from "@/components/shared/demo-links";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import dynamic from "next/dynamic";
import { useGuest } from "@/context/guest-context";

// THREE.js is ~170KB gzip — code-split it out of the first screen a guest loads.
const ClubLights = dynamic(() => import("@/components/fx/club-lights").then((m) => m.ClubLights), {
  ssr: false,
});
import { defaultLocale, getLocaleCookie, setLocaleCookie } from "@/i18n/config";
import { isDemoMode } from "@/features/shared/app-mode";
import { guestsService } from "@/features/guests/services";
import { reservationService } from "@/features/hospitality/reservation-service";
import { venueService } from "@/features/venue/services";
import type { Reservation, Venue, VenueTable, Zone } from "@/lib/types";

/**
 * QR entry page — guest lands here by scanning the QR code on a table.
 * If the table has an active confirmed reservation, the PIN gate blocks
 * entry until the correct 6-digit PIN is entered (or a manager seats
 * the party manually).
 */
export default function QrEntryPage({
  params,
}: {
  params: Promise<{ tableCode: string }>;
}) {
  const { tableCode } = use(params);
  const t = useTranslations("guest.qr");
  const router = useRouter();
  const { startSession } = useGuest();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ table: VenueTable; zone: Zone; venue: Venue } | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PIN gate state
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [validatingPin, setValidatingPin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let tableResult: { table: VenueTable; zone: Zone; venue: Venue } | null = null;
      try {
        tableResult = await venueService.getTableBySlug(tableCode);
      } catch {
        tableResult = null;
      }
      if (cancelled) return;
      setResult(tableResult);

      // The PIN gate is a separate read: if it fails, the guest still gets the
      // table. Folding it into the lookup above once turned any gate-check
      // error into a bogus "Table not found" for every scan.
      if (tableResult) {
        try {
          const reservation = await reservationService.getActiveReservationForTable(
            tableResult.table.id,
          );
          if (!cancelled) setActiveReservation(reservation);
        } catch {
          if (!cancelled) setActiveReservation(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tableCode]);

  async function handlePinSubmit() {
    if (!result || pin.length !== 6) return;
    setValidatingPin(true);
    setPinError(null);
    try {
      const res = await reservationService.validatePinAndSeat(result.table.id, pin);
      if (res.ok) {
        toast.success(t("pinConfirmed"));
        setActiveReservation(null);
      } else {
        const attempts = pinAttempts + 1;
        setPinAttempts(attempts);
        if (attempts >= 3) {
          setPinError(t("tooManyAttempts"));
        } else {
          setPinError(res.error ?? t("invalidPin"));
        }
      }
    } catch {
      setPinError(t("pinError"));
    } finally {
      setValidatingPin(false);
    }
  }

  async function handleJoin() {
    if (!result) return;
    if (!name.trim()) {
      setError(t("firstNameRequired"));
      return;
    }
    setJoining(true);
    try {
      const session = await guestsService.requestSession({
        tableId: result.table.id,
        tableCode: result.table.code,
        zoneName: result.zone.name,
        displayName: `${name.trim()} + ${partySize - 1}`,
        partySize,
        token: tableCode,
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
      // Seed the locale from the venue's guestLocale when the visitor has no
      // preference yet — a francophone venue's guests get French by default.
      if (getLocaleCookie() === defaultLocale && result.venue.guestLocale) {
        setLocaleCookie(result.venue.guestLocale === "fr" ? "fr" : "en");
      }
      router.push("/guest/waiting");
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : t("joinError"));
      setJoining(false);
    }
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
          title={t("tableNotFound")}
          description={isDemoMode()
            ? t("tableNotFoundDemo", { code: tableCode })
            : t("tableNotFoundLive", { code: tableCode })}
          action={<DemoOpenTableAction />}
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
            "radial-gradient(360px 240px at 50% 0%, oklch(from var(--gold) l c h / 18%), transparent)",
        }}
      />
      <div className="relative flex justify-center pt-6 animate-pop-in">
        {isDemoMode() && (
          <Button variant="ghost" size="sm" className="absolute left-0 top-5" asChild>
            <Link href="/demo"><ArrowLeft className="size-4" /> {t("backToDemo")}</Link>
          </Button>
        )}
        <BrandLogo variant="mark" />
      </div>

      <div className="relative mt-8 text-center animate-fade-up">
        <p className="text-sm text-muted-foreground">{t("welcomeTo")}</p>
        <h1 className="text-display text-gradient-gold mt-1 text-3xl">{result.venue.name}</h1>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary">
          <MapPin className="size-3.5" />
          {result.table.code} · {result.zone.name}
        </div>
      </div>

      {/* PIN gate: shown when table has an active confirmed reservation */}
      {activeReservation ? (
        <Card className="relative mt-8 animate-fade-up bg-card/80 backdrop-blur" style={{ animationDelay: "120ms" }}>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Lock className="size-5" />
              </div>
              <div>
                <p className="font-semibold">{t("tableReserved")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("tableReservedDesc")}
                </p>
              </div>
            </div>

            {isDemoMode() && activeReservation.reservationPin && (
              <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm">
                <span className="text-xs text-muted-foreground">{t("demoPin")} </span>
                <span className="font-mono font-semibold tracking-widest">{activeReservation.reservationPin}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pin-input">
                <KeyRound className="mr-1.5 inline size-3.5" />
                Reservation PIN
              </Label>
              <Input
                id="pin-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPin(v);
                  setPinError(null);
                }}
                className="h-12 text-center font-mono text-xl tracking-[0.3em]"
              />
              {pinError && <p className="text-sm text-red-600 dark:text-red-400">{pinError}</p>}
            </div>

            <Button
              size="lg"
              className="h-12 w-full"
              onClick={handlePinSubmit}
              disabled={pin.length !== 6 || validatingPin || pinAttempts >= 3}
            >
              {validatingPin && <Loader2 className="size-4 animate-spin" />}
              {validatingPin ? t("verifying") : t("unlockTable")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="relative mt-8 animate-fade-up bg-card/80 backdrop-blur" style={{ animationDelay: "120ms" }}>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="guest-name">{t("firstName")}</Label>
                <Input
                  id="guest-name"
                  placeholder={t("firstNamePlaceholder")}
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
                <Label>{t("partySize")}</Label>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <TooltipIconButton
                    tooltip={t("fewerPeople")}
                    variant="outline"
                    onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                  >
                    <Minus className="size-4" />
                  </TooltipIconButton>
                  <span className="flex items-center gap-2 font-semibold tabular-nums">
                    <Users className="size-4 text-muted-foreground" /> {partySize}
                  </span>
                  <TooltipIconButton
                    tooltip={t("morePeople")}
                    variant="outline"
                    onClick={() => setPartySize((n) => Math.min(result.table.seats, n + 1))}
                  >
                    <Plus className="size-4" />
                  </TooltipIconButton>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("tableSeats", { seats: result.table.seats })}
                </p>
              </div>

              <Button size="lg" className="h-12 w-full glow-primary" onClick={handleJoin} disabled={joining}>
                {joining && <Loader2 className="size-4 animate-spin" />}
                {joining ? t("requesting") : t("joinTable")}
              </Button>
            </CardContent>
          </Card>

          <p className="relative mt-6 text-center text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: "240ms" }}>
            {t("hostApproval")}
          </p>
        </>
      )}
    </div>
  );
}
