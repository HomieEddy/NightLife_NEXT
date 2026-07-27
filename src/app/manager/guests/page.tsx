"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldOff, UserSquare2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/context/auth-context";
import { guestService } from "@/lib/services/guest-service";
import { formatMoney, formatDate } from "@/lib/format";
import type { GuestProfile } from "@/lib/types";

export default function ManagerGuestsPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<GuestProfile[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GuestProfile | null>(null);
  const [banReason, setBanReason] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setProfiles(await guestService.listProfiles());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles ?? [];
    return (profiles ?? []).filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
  }, [profiles, query]);

  const mergeCandidates = (profiles ?? []).filter((p) => p.id !== selected?.id);

  async function toggleBan(profile: GuestProfile) {
    if (!user) return;
    setBusy(true);
    try {
      const updated = await guestService.setBanStatus(
        profile.id,
        { banned: profile.status !== "banned", reason: banReason || undefined },
        user.id,
        user.name,
      );
      toast.success(profile.status === "banned" ? `Lifted ban on ${profile.displayName}` : `Banned ${profile.displayName}`);
      setSelected(updated);
      setBanReason("");
      await refresh();
    } catch {
      toast.error("Could not update the ban status");
    } finally {
      setBusy(false);
    }
  }

  async function mergeInto() {
    if (!user || !selected || !mergeTargetId) return;
    setBusy(true);
    try {
      const merged = await guestService.mergeProfiles(selected.id, mergeTargetId, user.id, user.name);
      toast.success(`Merged into ${merged?.displayName}`);
      setSelected(null);
      setMergeTargetId("");
      await refresh();
    } catch {
      toast.error("Could not merge these profiles");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Guests" description="Persistent guest identity — profiles, VIP tiers and bans." />

      <Input placeholder="Search name, phone or email…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {profiles === null ? (
          <ListSkeleton rows={5} rowHeight="h-16" />
        ) : visible.length === 0 ? (
          <EmptyState icon={UserSquare2} title="No guests match" description="Profiles are created from reservations, guestlists, and door ID checks." />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {visible.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => { setSelected(profile); setBanReason(""); setMergeTargetId(""); }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                    selected?.id === profile.id ? "bg-accent/60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {profile.displayName}
                      {profile.status === "banned" && (
                        <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">Banned</Badge>
                      )}
                      {profile.vipTier !== "none" && profile.status === "active" && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 capitalize">
                          {profile.vipTier}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile.visitCount} visits · {formatMoney(profile.lifetimeNetCents / 100)} lifetime
                      {profile.lastVisitAt && ` · last seen ${formatDate(profile.lastVisitAt)}`}
                    </p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {selected && (
          <Card className={selected.status === "banned" ? "border-red-500/40" : undefined}>
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="text-lg font-semibold">{selected.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.phone && <>{selected.phone}<br /></>}
                  {selected.email}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Visits</p>
                  <p className="font-medium tabular-nums">{selected.visitCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lifetime</p>
                  <p className="font-medium tabular-nums">{formatMoney(selected.lifetimeNetCents / 100)}</p>
                </div>
              </div>

              {selected.notes && <p className="rounded-lg bg-muted/50 p-2.5 text-sm">{selected.notes}</p>}

              {selected.status === "banned" ? (
                <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                    <ShieldOff className="size-4" /> Banned
                  </p>
                  <p className="text-sm text-muted-foreground">{selected.banReason}</p>
                  <ConfirmDialog
                    trigger={<Button variant="outline" className="w-full" disabled={busy}>Lift ban</Button>}
                    title={`Lift ${selected.displayName}'s ban?`}
                    description="They will be admittable at the door again immediately."
                    confirmLabel="Lift ban"
                    onConfirm={() => toggleBan(selected)}
                  />
                </div>
              ) : (
                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="ban-reason">Ban reason</Label>
                  <Textarea
                    id="ban-reason"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Why is this guest being banned?"
                    rows={2}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button variant="destructive" className="w-full" disabled={!banReason.trim() || busy}>
                        Ban this guest
                      </Button>
                    }
                    title={`Ban ${selected.displayName}?`}
                    description="They'll be refused at the door on sight — security will see a blocking refusal card. This is always logged."
                    confirmLabel="Ban guest"
                    destructive
                    onConfirm={() => toggleBan(selected)}
                  />
                </div>
              )}

              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="merge-target" className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> Merge into another profile
                </Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger id="merge-target" className="w-full"><SelectValue placeholder="Choose the surviving profile" /></SelectTrigger>
                  <SelectContent>
                    {mergeCandidates.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="w-full" disabled={!mergeTargetId || busy}>
                      Merge duplicate
                    </Button>
                  }
                  title="Merge these profiles?"
                  description={`${selected.displayName}'s visit history and lifetime spend fold into the other profile. This can't be undone.`}
                  confirmLabel="Merge"
                  onConfirm={mergeInto}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
