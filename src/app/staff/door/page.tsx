"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertOctagon, Check, Clock, DoorOpen, LogOut, Minus, Plus,
  Search, Shield, ShieldOff, Shirt, Siren, UserPlus, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { doorService } from "@/features/door/services";
import { guestService } from "@/features/sessions/services";
import { permissionService } from "@/features/platform/permission-service";
import { reservationService } from "@/features/hospitality/reservation-service";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { waitlistService } from "@/features/door/waitlist-service";
import type { WaitlistEntryWithPosition } from "@/features/door/waitlist-service";
import { canDo } from "@/features/shared/permissions";
import type { RolePermissions } from "@/features/shared/permissions";
import { isBanned, occupancyRatio } from "@/lib/door";
import { formatMoney, timeAgo } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type {
  Admission, AdmissionType, CoatCheckTicket, GuestProfile, Reservation, StaffMember, Venue,
} from "@/lib/types";

type SearchResult =
  | { kind: "profile"; id: string; label: string; sub: string; profile: GuestProfile }
  | { kind: "reservation"; id: string; label: string; sub: string; reservation: Reservation };

const QUOTE_PRESETS = [15, 30, 45];

const zAdmitForm = z.object({
  partySize: z.number().int().min(1).default(2),
  admissionType: z.enum(["cover", "comp", "guestlist", "reservation", "member"]).default("cover"),
  idChecked: z.boolean().default(false),
  dobVerified: z.boolean().default(false),
  yearOfBirth: z.string().default(""),
  overrideReason: z.string().default(""),
});

export default function StaffDoorPage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [occupancy, setOccupancy] = useState<{ current: number; legalCapacity: number } | null>(null);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntryWithPosition[] | null>(null);
  const [coatCheck, setCoatCheck] = useState<CoatCheckTicket[] | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  // Admit form state
  const admitForm = useForm({
    resolver: zodResolver(zAdmitForm),
    defaultValues: { partySize: 2, admissionType: "cover" as const, idChecked: false, dobVerified: false, yearOfBirth: "", overrideReason: "" },
  });
  const { register: admitReg, handleSubmit: admitHandle, reset: admitReset, setValue: admitSet, watch: admitWatch, formState: { isSubmitting: admitBusy } } = admitForm;

  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // S-03: Evacuation state
  const [evacState, setEvacState] = useState<string>("normal");
  const [admitError, setAdmitError] = useState<string | null>(null);

  // Waitlist join form
  const wlSchema = z.object({ name: z.string().min(1, "Name is required"), partySize: z.number().int().min(1).default(2), quotedMinutes: z.number().int().min(5).max(180).default(15) });
  const wlForm = useForm({
    resolver: zodResolver(wlSchema),
    defaultValues: { name: "", partySize: 2, quotedMinutes: 15 },
  });
  const { register: wlReg, handleSubmit: wlHandle, reset: wlReset, setValue: wlSet, watch: wlWatch, formState: { isSubmitting: wlBusy } } = wlForm;

  const refresh = useCallback(async () => {
    const [currentStaff, perms, v, occ, adm, wl, evac] = await Promise.all([
      staffService.getCurrentStaff(),
      permissionService.getRolePermissions("venue-1"),
      venueService.getVenue(),
      doorService.getOccupancy(),
      doorService.listAdmissions(),
      waitlistService.listEntries(),
      doorService.getEvacuationState(),
    ]);
    setMe(currentStaff);
    setPermissions(perms);
    setVenue(v);
    setOccupancy(occ);
    setAdmissions(adm);
    setWaitlist(wl);
    setEvacState(evac.state);
    admitSet("idChecked", v.doorRequiresIdCheck);
    if (v.coatCheckEnabled) setCoatCheck(await doorService.listCoatCheckTickets());
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const canAdmit = !!(me && permissions && canDo(permissions, me.role, "door:admit"));
  const canCount = !!(me && permissions && canDo(permissions, me.role, "door:count"));
  const canOverrideBan = !!(me && permissions && canDo(permissions, me.role, "door:admit-banned-override"));
  const canManageWaitlist = !!(me && permissions && canDo(permissions, me.role, "waitlist:manage"));
  const canEvacuate = !!(me && permissions && canDo(permissions, me.role, "emergency:evacuate"));
  const canResume = !!(me && permissions && canDo(permissions, me.role, "emergency:resume"));
  const canOverrideCapacity = !!(me && permissions && canDo(permissions, me.role, "door:admit-capacity-override"));

  async function runSearch(q: string) {
    setQuery(q);
    setSelected(null);
    if (!q.trim()) { setResults(null); return; }
    const [profiles, reservations] = await Promise.all([
      guestService.searchProfiles(q),
      reservationService.listReservations({ status: ["requested", "confirmed"] }),
    ]);
    const matchingRes = reservations.filter((r) =>
      r.guestName.toLowerCase().includes(q.trim().toLowerCase()),
    );
    setResults([
      ...profiles.map((p): SearchResult => ({
        kind: "profile",
        id: `profile-${p.id}`,
        label: p.displayName,
        sub: p.vipTier !== "none" ? `${p.vipTier.toUpperCase()} · ${p.visitCount} visits` : `${p.visitCount} visits`,
        profile: p,
      })),
      ...matchingRes.map((r): SearchResult => ({
        kind: "reservation",
        id: `res-${r.id}`,
        label: r.guestName,
        sub: `Reservation · party of ${r.partySize} · ${r.status}`,
        reservation: r,
      })),
    ]);
  }

  function selectResult(result: SearchResult) {
    setSelected(result);
    admitSet("overrideReason", "");
    setAdmitError(null);
    admitSet("yearOfBirth", "");
    const size = result.kind === "reservation" ? result.reservation.partySize : 2;
    admitSet("partySize", size);
    admitSet("admissionType", result.kind === "reservation" ? "reservation" : "cover");
    admitSet("idChecked", venue?.doorRequiresIdCheck ?? false);
    admitSet("dobVerified", false);
  }

  const selectedProfile = selected?.kind === "profile" ? selected.profile : undefined;
  const banned = isBanned(selectedProfile);
  const openAdmission = selectedProfile
    ? admissions.find((a) => a.guestProfileId === selectedProfile.id && !a.exitedAt)
    : undefined;
  const exitedAdmission = selectedProfile && !openAdmission
    ? admissions.find((a) => a.guestProfileId === selectedProfile.id && a.exitedAt)
    : undefined;

  async function doAdjust(delta: number) {
    if (!me) return;
    const res = await doorService.adjustOccupancy(delta, delta > 0 ? "manual count in" : "manual count out", me.id);
    if (!res.ok) {
      toast.error(res.error ?? "Could not adjust occupancy");
      return;
    }
    setOccupancy((prev) => (prev ? { ...prev, current: res.current } : prev));
  }

  const onAdmit = admitHandle(async (data) => {
    if (!me || !selected) return;
    setBusy(true);
    setAdmitError(null);
    try {
      const guestProfileId = selectedProfile?.id;
      const reservationId = selected.kind === "reservation" ? selected.reservation.id : undefined;
      await doorService.admit({
        guestProfileId,
        partySize: data.partySize ?? 1,
        admissionType: data.admissionType ?? "cover",
        amountOwedCents: (data.admissionType ?? "cover") === "cover" ? (data.partySize ?? 1) * 4000 : 0,
        source: reservationId ? "reservation" : "walk-in",
        reservationId,
        idCheck: data.idChecked ? { checked: true, dobVerified: data.dobVerified, yearOfBirth: data.yearOfBirth ? Number(data.yearOfBirth) : undefined } : undefined,
        staffId: me.id,
        staffName: me.name,
      });
      if (reservationId) {
        await reservationService.setStatus(reservationId, "seated");
      }
      toast.success(`Admitted ${selected.label} — party of ${data.partySize}`);
      setSelected(null);
      setQuery("");
      setResults(null);
      await refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not admit this party";
      setAdmitError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  });

  async function overrideAndAdmit() {
    if (!me || !selectedProfile || !(admitWatch("overrideReason") ?? "").trim()) return;
    setBusy(true);
    try {
      await doorService.admitBannedOverride({
        guestProfileId: selectedProfile.id,
        partySize: admitWatch("partySize") ?? 1,
        reason: (admitWatch("overrideReason") ?? "").trim(),
        staffId: me.id,
        staffName: me.name,
      });
      toast.success(`Override recorded — ${selectedProfile.displayName} admitted, incident logged`);
      setSelected(null);
      setQuery("");
      setResults(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not admit this party");
    } finally {
      setBusy(false);
    }
  }

  // ---------- S-03: Emergency evacuation ----------

  async function doEvacuate() {
    if (!me) return;
    setBusy(true);
    try {
      await doorService.evacuate(me.id, me.name);
      toast.success("Emergency evacuation triggered — occupancy zeroed");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not trigger evacuation");
    } finally {
      setBusy(false);
    }
  }

  async function doResumeEvacuation() {
    if (!me) return;
    setBusy(true);
    try {
      await doorService.resumeEvacuation(me.id, me.name);
      toast.success("Operations resumed — admissions re-enabled");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resume");
    } finally {
      setBusy(false);
    }
  }

  // ---------- S-13: Capacity override ----------

  async function capacityOverride() {
    if (!me || !selected) return;
    setBusy(true);
    try {
      await doorService.admitCapacityOverride({
        guestProfileId: selectedProfile?.id,
        partySize: admitWatch("partySize") ?? 1,
        reason: (admitWatch("overrideReason") ?? "").trim(),
        staffId: me.id,
        staffName: me.name,
      });
      toast.success(`Capacity override — admitted ${selected.label}, party of ${admitWatch("partySize") ?? 1}`);
      setSelected(null);
      setQuery("");
      setResults(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Override failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordExit() {
    if (!me || !openAdmission) return;
    setBusy(true);
    try {
      await doorService.recordExit(openAdmission.id, me.id);
      toast.success(`${selected?.label} marked as exited`);
      setSelected(null);
      await refresh();
    } catch {
      toast.error("Could not record the exit");
    } finally {
      setBusy(false);
    }
  }

  async function reEnter() {
    if (!me || !exitedAdmission) return;
    setBusy(true);
    try {
      await doorService.reEnter(exitedAdmission.id, me.id, me.name);
      toast.success(`${selected?.label} re-admitted`);
      setSelected(null);
      await refresh();
    } catch {
      toast.error("Could not process the re-entry");
    } finally {
      setBusy(false);
    }
  }

  const onJoinWaitlist = wlHandle(async (data) => {
    setBusy(true);
    try {
      await waitlistService.join({ name: data.name.trim(), partySize: data.partySize, quotedMinutes: data.quotedMinutes });
      wlReset();
      toast.success(`${data.name.trim()} added to the waitlist`);
      setWaitlist(await waitlistService.listEntries());
    } catch {
      toast.error("Could not add to the waitlist");
    } finally {
      setBusy(false);
    }
  });

  async function waitlistAction(id: string, status: "notified" | "left" | "seated") {
    await waitlistService.setStatus(id, status);
    setWaitlist(await waitlistService.listEntries());
  }

  async function checkInCoat() {
    if (!me) return;
    const ticket = await doorService.checkInCoat({ itemCount: 1, staffId: me.id });
    toast.success(`Ticket #${ticket.ticketNumber} checked in`);
    setCoatCheck(await doorService.listCoatCheckTickets());
  }

  async function claimCoat(ticketId: string) {
    await doorService.claimCoat(ticketId);
    setCoatCheck(await doorService.listCoatCheckTickets());
  }

  if (me && permissions && !canCount && !canAdmit) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ShieldOff}
          title="Not available for your role"
          description="The door is operated by hosts, security and managers."
        />
      </div>
    );
  }

  const ratio = occupancy ? occupancyRatio(occupancy.current, occupancy.legalCapacity) : 0;
  const capacityTone = ratio >= 1 ? "critical" : ratio >= (venue?.occupancyWarnRatio ?? 0.9) ? "warning" : "ok";

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          <DoorOpen className="size-5 text-primary" /> Door
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Occupancy, arrivals and the waitlist</p>
      </div>

      {/* S-03: Evacuation banner */}
      {evacState !== "normal" && (
        <Card className="border-red-500/40 bg-red-500/10 py-4">
          <CardContent className="px-5 text-center space-y-3">
            <Siren className="size-8 text-red-500 mx-auto" />
            <p className="font-bold text-lg text-red-600 dark:text-red-400">Emergency Evacuation Active</p>
            <p className="text-sm text-muted-foreground">Admissions are disabled. All staff and guests must exit.</p>
            {canResume && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="border-red-500/50" disabled={busy}>
                    Resume normal operations
                  </Button>
                }
                title="Resume normal operations?"
                description="This ends the evacuation, restores the headcount, and re-enables admissions. This action is audited."
                confirmLabel="Resume operations"
                onConfirm={doResumeEvacuation}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Occupancy header — big count, ≥56px thumb targets */}
      <Card
        className={cn(
          "py-5",
          capacityTone === "critical" && "border-red-500/40 bg-red-500/5",
          capacityTone === "warning" && "border-amber-500/40 bg-amber-500/5",
        )}
      >
        <CardContent className="space-y-4 px-5">
          {occupancy === null ? (
            <Skeleton />
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className={cn(
                      "text-4xl font-bold tabular-nums",
                      capacityTone === "critical" && "text-red-600 dark:text-red-400",
                      capacityTone === "warning" && "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {occupancy.current}
                    <span className="text-lg font-normal text-muted-foreground"> / {occupancy.legalCapacity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Legal capacity</p>
                </div>
                {capacityTone !== "ok" && (
                  <AlertOctagon
                    className={cn(
                      "size-6",
                      capacityTone === "critical" ? "text-red-500" : "text-amber-500",
                    )}
                  />
                )}
              </div>
              {canCount && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-14 flex-1 text-base"
                    onClick={() => doAdjust(-1)}
                  >
                    <Minus className="size-5" /> Out
                  </Button>
                  <Button className="h-14 flex-1 text-base" onClick={() => doAdjust(1)}>
                    <Plus className="size-5" /> In
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Search — one box across reservations, guestlists and known profiles */}
      {canAdmit && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-12 pl-9 text-base"
              placeholder="Search a name to admit…"
              value={query}
              onChange={(e) => runSearch(e.target.value)}
            />
          </div>

          {results !== null && results.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No match — admit as a new walk-in below.</p>
          )}

          {results !== null && results.length > 0 && !selected && (
            <div className="space-y-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="flex w-full min-h-14 items-center justify-between rounded-lg border bg-card/50 px-4 py-3 text-left transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <Card className={cn(banned && "border-red-500/50")}>
              <CardContent className="space-y-4 px-4 pt-4">
                {banned && selectedProfile ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <ShieldOff className="size-5" />
                      <p className="font-semibold">Refuse entry — banned</p>
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">{selectedProfile.displayName}</span> is banned:{" "}
                      {selectedProfile.banReason}
                    </p>
                    {canOverrideBan ? (
                      <div className="space-y-2 border-t pt-3">
                        <Label htmlFor="override-reason">Manager override reason</Label>
                        <Textarea
                          id="override-reason"
                          {...admitReg("overrideReason")}
                          placeholder="Why is this override justified?"
                          rows={2}
                        />
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="destructive"
                              className="h-12 w-full"
                              disabled={!(admitWatch("overrideReason") ?? "").trim() || busy}
                            >
                              Override ban and admit anyway
                            </Button>
                          }
                          title="Override this ban?"
                          description="This admits a banned guest and writes a permanent audit entry — it cannot be undone silently."
                          confirmLabel="Override and admit"
                          destructive
                          onConfirm={overrideAndAdmit}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Only a manager can override a ban. Ask a manager to admit this guest if needed.
                      </p>
                    )}
                    <Button variant="ghost" className="w-full" onClick={() => setSelected(null)}>
                      Dismiss
                    </Button>
                  </div>
                ) : openAdmission ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      <span className="font-medium">{selected.label}</span> is already inside
                      {" "}(admitted {timeAgo(openAdmission.admittedAt)}).
                    </p>
                    <Button className="h-12 w-full" disabled={busy} onClick={recordExit}>
                      <LogOut className="size-4" /> Record exit
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setSelected(null)}>Cancel</Button>
                  </div>
                ) : exitedAdmission ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      <span className="font-medium">{selected.label}</span> already visited tonight and exited
                      {" "}{timeAgo(exitedAdmission.exitedAt!)}.
                    </p>
                    <Button className="h-12 w-full" disabled={busy} onClick={reEnter}>
                      <DoorOpen className="size-4" /> Re-entry
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setSelected(null)}>Cancel</Button>
                  </div>
                ) : (
                  <form onSubmit={onAdmit}>
                    <p className="font-medium">{selected.label}</p>
                    {selectedProfile?.vipTier && selectedProfile.vipTier !== "none" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {selectedProfile.vipTier.toUpperCase()} · {selectedProfile.visitCount} visits ·{" "}
                        {formatMoney(selectedProfile.lifetimeNetCents / 100)} lifetime
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Party size</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11"
                            onClick={() => admitSet("partySize", Math.max(1, admitWatch("partySize") ?? 1 - 1))}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-8 text-center text-lg font-semibold tabular-nums">{admitWatch("partySize") ?? 1}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11"
                            onClick={() => admitSet("partySize", admitWatch("partySize") ?? 1 + 1)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Admission type</Label>
                        <Select value={admitWatch("admissionType")} onValueChange={(v) => admitSet("admissionType", v as AdmissionType)}>
                          <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">Cover</SelectItem>
                            <SelectItem value="comp">Comp</SelectItem>
                            <SelectItem value="guestlist">Guestlist</SelectItem>
                            <SelectItem value="reservation">Reservation</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">ID checked</p>
                        <p className="text-xs text-muted-foreground">
                          Records the check only — never a document number or scan
                        </p>
                      </div>
                      <Switch checked={admitWatch("idChecked")} onCheckedChange={(v) => admitSet("idChecked", v)} />
                    </div>
                    {admitWatch("idChecked") && (
                      <>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                          <p className="text-sm font-medium">Age verified 18+</p>
                          <Switch checked={admitWatch("dobVerified")} onCheckedChange={(v) => admitSet("dobVerified", v)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="yob">Year of birth (optional — never stored as a full date)</Label>
                          <Input
                            id="yob"
                            type="number"
                            min={1900}
                            max={new Date().getFullYear()}
                            {...admitReg("yearOfBirth")}
                            placeholder="e.g. 1996"
                            className="h-11"
                          />
                        </div>
                      </>
                    )}
                    {admitError && admitError.includes("capacity") && canOverrideCapacity && (
                      <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">At capacity — manager override required</p>
                        <Label htmlFor="override-reason-cancel">Override reason</Label>
                        <Input
                          id="override-reason-cancel"
                          {...admitReg("overrideReason")}
                          placeholder="Why is this admission necessary?"
                          className="h-11"
                        />
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="outline"
                              className="h-11 w-full border-amber-500/50"
                              disabled={!(admitWatch("overrideReason") ?? "").trim() || busy}
                            >
                              Override capacity and admit
                            </Button>
                          }
                          title="Override legal capacity?"
                          description={`This admits ${selected?.label} past the legal capacity limit — the reason is recorded in the audit trail and cannot be undone silently.`}
                          confirmLabel="Override and admit"
                          onConfirm={capacityOverride}
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" className="h-12 flex-1" onClick={() => setSelected(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="h-12 flex-1 text-base" disabled={busy}>
                        <Check className="size-4" /> Admit
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Waitlist */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Users className="size-4" /> Waitlist
        </h2>
        {waitlist === null ? (
          <ListSkeleton rows={2} rowHeight="h-16" />
        ) : (
          <>
            {waitlist.filter((w) => w.status === "waiting" || w.status === "notified").length === 0 ? (
              <EmptyState icon={Users} title="No one waiting" description="Admissions and occupancy tracking will appear here when the venue opens." />
            ) : (
              <div className="stagger-children space-y-2">
                {waitlist
                  .filter((w) => w.status === "waiting" || w.status === "notified")
                  .map((entry) => {
                    const elapsed = Math.round((nowMs - new Date(entry.joinedAt).getTime()) / 60_000);
                    const over = elapsed > entry.quotedMinutes;
                    return (
                      <Card key={entry.id} className={cn(over && "border-amber-500/40")}>
                        <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              #{entry.position ?? "—"} {entry.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Party of {entry.partySize} · {elapsed}m elapsed, quoted {entry.quotedMinutes}m
                              {entry.status === "notified" && " · notified"}
                            </p>
                          </div>
                          {canManageWaitlist && (
                            <div className="flex shrink-0 gap-1.5">
                              {entry.status === "waiting" && (
                                <Button size="sm" variant="outline" className="h-9" onClick={() => waitlistAction(entry.id, "notified")}>
                                  Notify
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-9" onClick={() => waitlistAction(entry.id, "left")}>
                                Leave
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}

            {canManageWaitlist && (
              <Card>
                <form onSubmit={onJoinWaitlist}>
                <CardContent className="space-y-3 px-4 pt-4">
                  <p className="text-sm font-medium">Add a walk-in</p>
                  <Input placeholder="Name" {...wlReg("name")} className="h-11" />
                  {wlForm.formState.errors.name && <p className="text-xs text-destructive">{wlForm.formState.errors.name.message}</p>}
                  <div className="flex items-center gap-2">
                    <Label className="w-20 shrink-0 text-xs">Party</Label>
                    <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => wlSet("partySize", Math.max(1, (wlWatch("partySize") ?? 2) - 1))}>
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-6 text-center tabular-nums">{wlWatch("partySize") ?? 2}</span>
                    <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => wlSet("partySize", (wlWatch("partySize") ?? 2) + 1)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-20 shrink-0 text-xs">Quote</Label>
                    <div className="flex gap-1.5">
                      {QUOTE_PRESETS.map((m) => (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={wlWatch("quotedMinutes") === m ? "default" : "outline"}
                          className="h-9"
                          onClick={() => wlSet("quotedMinutes", m)}
                        >
                          <Clock className="size-3.5" /> {m}m
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={!wlWatch("name")?.trim() || busy || wlBusy}>
                    <UserPlus className="size-4" /> Add to waitlist
                  </Button>
                </CardContent>
                </form>
              </Card>
            )}
          </>
        )}
      </section>

      {/* Coat check — gated entirely behind venue.coatCheckEnabled */}
      {venue?.coatCheckEnabled && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Shirt className="size-4" /> Coat check
          </h2>
          <Button variant="outline" className="h-11 w-full" onClick={checkInCoat}>
            <Plus className="size-4" /> Check in a coat
          </Button>
          {coatCheck && coatCheck.filter((t) => !t.claimedAt).length > 0 && (
            <div className="stagger-children space-y-2">
              {coatCheck
                .filter((t) => !t.claimedAt)
                .map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                    <p className="text-sm">
                      Ticket <span className="font-semibold">#{ticket.ticketNumber}</span> · {ticket.itemCount} item(s)
                    </p>
                    <Button size="sm" variant="outline" className="h-9" onClick={() => claimCoat(ticket.id)}>
                      Claim
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* S-03: Emergency evacuation trigger — visible to security + managers only */}
      {canEvacuate && evacState === "normal" && (
        <section className="space-y-3 border-t border-red-500/20 pt-4">
          <ConfirmDialog
            trigger={
              <Button variant="destructive" className="h-14 w-full text-base" disabled={busy}>
                <Siren className="size-5" /> Trigger Emergency Evacuation
              </Button>
            }
            title="Trigger emergency evacuation?"
            description="This zeros occupancy, blocks all admissions, and creates a permanent audit entry. All staff will see the evacuation alert."
            confirmLabel="Evacuate now"
            destructive
            onConfirm={doEvacuate}
          />
          <p className="text-center text-xs text-muted-foreground">
            Only use in a real emergency — this is audited and cannot be undone silently.
          </p>
        </section>
      )}

      {!canAdmit && !canCount && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="size-3.5" /> You have read-only access to the door.
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="h-24 animate-pulse rounded-lg bg-muted" />;
}
