"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertOctagon, Check, Clock, DoorOpen, LogOut, Minus, Plus,
  Search, Shield, ShieldOff, Shirt, UserPlus, Users,
} from "lucide-react";
import { toast } from "sonner";
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
import { doorService } from "@/lib/services/door-service";
import { guestService } from "@/lib/services/guest-service";
import { permissionService } from "@/lib/services/permission-service";
import { reservationService } from "@/lib/services/reservation-service";
import { staffService } from "@/lib/services/staff-service";
import { venueService } from "@/lib/services/venue-service";
import { waitlistService } from "@/lib/services/waitlist-service";
import type { WaitlistEntryWithPosition } from "@/lib/mock-services/waitlist-service";
import { canDo } from "@/lib/permissions";
import type { RolePermissions } from "@/lib/permissions";
import { isBanned, occupancyRatio } from "@/lib/door";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Admission, AdmissionType, CoatCheckTicket, GuestProfile, Reservation, StaffMember, Venue,
} from "@/lib/types";

type SearchResult =
  | { kind: "profile"; id: string; label: string; sub: string; profile: GuestProfile }
  | { kind: "reservation"; id: string; label: string; sub: string; reservation: Reservation };

const QUOTE_PRESETS = [15, 30, 45];

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
  const [partySize, setPartySize] = useState(1);
  const [admissionType, setAdmissionType] = useState<AdmissionType>("cover");
  const [idChecked, setIdChecked] = useState(false);
  const [dobVerified, setDobVerified] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Waitlist join form
  const [wlName, setWlName] = useState("");
  const [wlParty, setWlParty] = useState(2);
  const [wlQuote, setWlQuote] = useState(15);

  const refresh = useCallback(async () => {
    const [currentStaff, perms, v, occ, adm, wl] = await Promise.all([
      staffService.getCurrentStaff(),
      permissionService.getRolePermissions("venue-1"),
      venueService.getVenue(),
      doorService.getOccupancy(),
      doorService.listAdmissions(),
      waitlistService.listEntries(),
    ]);
    setMe(currentStaff);
    setPermissions(perms);
    setVenue(v);
    setOccupancy(occ);
    setAdmissions(adm);
    setWaitlist(wl);
    setIdChecked(v.doorRequiresIdCheck);
    if (v.coatCheckEnabled) setCoatCheck(await doorService.listCoatCheckTickets());
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => { refresh(); }, [refresh]);

  const canAdmit = !!(me && permissions && canDo(permissions, me.role, "door:admit"));
  const canCount = !!(me && permissions && canDo(permissions, me.role, "door:count"));
  const canOverrideBan = !!(me && permissions && canDo(permissions, me.role, "door:admit-banned-override"));
  const canManageWaitlist = !!(me && permissions && canDo(permissions, me.role, "waitlist:manage"));

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
    setOverrideReason("");
    const size = result.kind === "reservation" ? result.reservation.partySize : 2;
    setPartySize(size);
    setAdmissionType(result.kind === "reservation" ? "reservation" : "cover");
    setIdChecked(venue?.doorRequiresIdCheck ?? false);
    setDobVerified(false);
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

  async function admit() {
    if (!me || !selected) return;
    setBusy(true);
    try {
      const guestProfileId = selectedProfile?.id;
      const reservationId = selected.kind === "reservation" ? selected.reservation.id : undefined;
      await doorService.admit({
        guestProfileId,
        partySize,
        admissionType,
        amountOwedCents: admissionType === "cover" ? partySize * 4000 : 0,
        source: reservationId ? "reservation" : "walk-in",
        reservationId,
        idCheck: idChecked ? { checked: true, dobVerified } : undefined,
        staffId: me.id,
        staffName: me.name,
      });
      if (reservationId) {
        await reservationService.setStatus(reservationId, "seated");
      }
      toast.success(`Admitted ${selected.label} — party of ${partySize}`);
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

  async function overrideAndAdmit() {
    if (!me || !selectedProfile || !overrideReason.trim()) return;
    setBusy(true);
    try {
      await doorService.admitBannedOverride({
        guestProfileId: selectedProfile.id,
        partySize,
        reason: overrideReason.trim(),
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

  async function joinWaitlist() {
    if (!wlName.trim()) return;
    setBusy(true);
    try {
      await waitlistService.join({ name: wlName.trim(), partySize: wlParty, quotedMinutes: wlQuote });
      setWlName("");
      setWlParty(2);
      setWlQuote(15);
      toast.success(`${wlName.trim()} added to the waitlist`);
      setWaitlist(await waitlistService.listEntries());
    } catch {
      toast.error("Could not add to the waitlist");
    } finally {
      setBusy(false);
    }
  }

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
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          <DoorOpen className="size-5 text-primary" /> Door
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Occupancy, arrivals and the waitlist</p>
      </div>

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
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="Why is this override justified?"
                          rows={2}
                        />
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="destructive"
                              className="h-12 w-full"
                              disabled={!overrideReason.trim() || busy}
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
                  <>
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
                            variant="outline"
                            size="icon"
                            className="size-11"
                            onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-8 text-center text-lg font-semibold tabular-nums">{partySize}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-11"
                            onClick={() => setPartySize((p) => p + 1)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Admission type</Label>
                        <Select value={admissionType} onValueChange={(v) => setAdmissionType(v as AdmissionType)}>
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
                      <Switch checked={idChecked} onCheckedChange={setIdChecked} />
                    </div>
                    {idChecked && (
                      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                        <p className="text-sm font-medium">Age verified 18+</p>
                        <Switch checked={dobVerified} onCheckedChange={setDobVerified} />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" className="h-12 flex-1" onClick={() => setSelected(null)}>
                        Cancel
                      </Button>
                      <Button className="h-12 flex-1 text-base" disabled={busy} onClick={admit}>
                        <Check className="size-4" /> Admit
                      </Button>
                    </div>
                  </>
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
              <EmptyState icon={Users} title="No one waiting" description="Walk-ins you add show up here." />
            ) : (
              <div className="space-y-2">
                {waitlist
                  .filter((w) => w.status === "waiting" || w.status === "notified")
                  .map((entry) => {
                    const elapsed = Math.round((Date.now() - new Date(entry.joinedAt).getTime()) / 60_000);
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
                <CardContent className="space-y-3 px-4 pt-4">
                  <p className="text-sm font-medium">Add a walk-in</p>
                  <Input placeholder="Name" value={wlName} onChange={(e) => setWlName(e.target.value)} className="h-11" />
                  <div className="flex items-center gap-2">
                    <Label className="w-20 shrink-0 text-xs">Party</Label>
                    <Button variant="outline" size="icon" className="size-9" onClick={() => setWlParty((p) => Math.max(1, p - 1))}>
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-6 text-center tabular-nums">{wlParty}</span>
                    <Button variant="outline" size="icon" className="size-9" onClick={() => setWlParty((p) => p + 1)}>
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
                          variant={wlQuote === m ? "default" : "outline"}
                          className="h-9"
                          onClick={() => setWlQuote(m)}
                        >
                          <Clock className="size-3.5" /> {m}m
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button className="h-11 w-full" disabled={!wlName.trim() || busy} onClick={joinWaitlist}>
                    <UserPlus className="size-4" /> Add to waitlist
                  </Button>
                </CardContent>
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
            <div className="space-y-2">
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
