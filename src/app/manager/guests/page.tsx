"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Plus, Search, ShieldOff, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { guestService } from "@/lib/services/guest-service";
import { formatMoney, formatDate } from "@/lib/format";
import type { GuestProfile, GuestTag, GuestVipTier } from "@/lib/types";

const VIP_OPTIONS: { value: GuestVipTier; label: string }[] = [
  { value: "none", label: "None" }, { value: "regular", label: "Regular" }, { value: "vip", label: "VIP" }, { value: "host-list", label: "Host list" },
];
const TAG_OPTIONS: GuestTag[] = ["regular", "industry", "influencer", "birthday", "allergy-noted", "high-spender"];

export default function ManagerGuestsPage() {
  const [profiles, setProfiles] = useState<GuestProfile[] | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<GuestProfile | null>(null);
  const [banReason, setBanReason] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [vipFilter, setVipFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [spendMin, setSpendMin] = useState("");
  const [spendMax, setSpendMax] = useState("");
  const [visitsMin, setVisitsMin] = useState("");
  const [visitsMax, setVisitsMax] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GuestProfile | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", dobYear: "", vipTier: "none" as GuestVipTier, tags: [] as GuestTag[], notes: "", marketingEmail: false, marketingSms: false });

  const refresh = useCallback(async () => { setProfiles(await guestService.listProfiles()); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const visible = useMemo(() => {
    let list = profiles ?? [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.displayName.toLowerCase().includes(q) || (p.phone ?? "").includes(q) || (p.email ?? "").toLowerCase().includes(q));
    if (statusFilter === "active") list = list.filter((p) => p.status === "active");
    if (statusFilter === "banned") list = list.filter((p) => p.status === "banned");
    if (vipFilter !== "all") list = list.filter((p) => p.vipTier === vipFilter);
    if (tagFilter !== "all") list = list.filter((p) => p.tags.includes(tagFilter as GuestTag));
    const sMin = parseInt(spendMin); const sMax = parseInt(spendMax);
    if (!isNaN(sMin)) list = list.filter((p) => p.lifetimeNetCents >= sMin * 100);
    if (!isNaN(sMax)) list = list.filter((p) => p.lifetimeNetCents <= sMax * 100);
    const vMin = parseInt(visitsMin); const vMax = parseInt(visitsMax);
    if (!isNaN(vMin)) list = list.filter((p) => p.visitCount >= vMin);
    if (!isNaN(vMax)) list = list.filter((p) => p.visitCount <= vMax);
    // Sort
    if (sortBy === "name") list = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    else if (sortBy === "visits") list = [...list].sort((a, b) => b.visitCount - a.visitCount);
    else if (sortBy === "lifetime") list = [...list].sort((a, b) => b.lifetimeNetCents - a.lifetimeNetCents);
    else if (sortBy === "lastVisit") list = [...list].sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
    return list;
  }, [profiles, query, statusFilter, vipFilter, tagFilter, spendMin, spendMax, visitsMin, visitsMax, sortBy]);

  const filterCount = [vipFilter !== "all", tagFilter !== "all", spendMin || spendMax, visitsMin || visitsMax].filter(Boolean).length;

  const mergeCandidates = (profiles ?? []).filter((p) => p.id !== selected?.id);

  function openCreate() {
    setEditing(null);
    setForm({ firstName: "", lastName: "", phone: "", email: "", dobYear: "", vipTier: "none", tags: [], notes: "", marketingEmail: false, marketingSms: false });
    setDialogOpen(true);
  }

  function openEdit(profile: GuestProfile) {
    setEditing(profile);
    setForm({ firstName: profile.firstName, lastName: profile.lastName ?? "", phone: profile.phone ?? "", email: profile.email ?? "", dobYear: profile.dobYear ? String(profile.dobYear) : "", vipTier: profile.vipTier, tags: profile.tags, notes: profile.notes ?? "", marketingEmail: profile.marketingConsent.email, marketingSms: profile.marketingConsent.sms });
    setDialogOpen(true);
  }

  async function saveProfile() {
    if (!form.firstName.trim()) { toast.error("First name is required"); return; }
    setBusy(true);
    try {
      if (editing) {
        await guestService.updateProfile(editing.id, {
          firstName: form.firstName.trim(), lastName: form.lastName.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, dobYear: form.dobYear ? parseInt(form.dobYear) : undefined, tags: form.tags, vipTier: form.vipTier, notes: form.notes.trim() || undefined,
        }, "manager", "Manager");
        toast.success(`Updated ${form.firstName}`);
      } else {
        await guestService.createProfile({
          firstName: form.firstName.trim(), lastName: form.lastName.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, dobYear: form.dobYear ? parseInt(form.dobYear) : undefined, tags: form.tags, vipTier: form.vipTier, notes: form.notes.trim() || undefined, marketingConsent: { email: form.marketingEmail, sms: form.marketingSms }, source: "manager",
        });
        toast.success(`Created profile for ${form.firstName}`);
      }
      setDialogOpen(false);
      await refresh();
    } catch { toast.error("Could not save profile"); } finally { setBusy(false); }
  }

  async function toggleBan(profile: GuestProfile) {
    setBusy(true); try {
      await guestService.setBanStatus(profile.id, { banned: profile.status !== "banned", reason: banReason || undefined }, "manager", "Manager");
      toast.success(profile.status === "banned" ? `Lifted ban on ${profile.displayName}` : `Banned ${profile.displayName}`);
      setBanReason(""); await refresh();
    } catch { toast.error("Could not update ban status"); } finally { setBusy(false); }
  }

  async function mergeInto() {
    if (!selected || !mergeTargetId) return; setBusy(true); try {
      const merged = await guestService.mergeProfiles(selected.id, mergeTargetId, "manager", "Manager");
      toast.success(`Merged into ${merged?.displayName}`);
      setSelected(null); setMergeTargetId(""); await refresh();
    } catch { toast.error("Could not merge"); } finally { setBusy(false); }
  }

  function toggleTag(tag: GuestTag) {
    setForm((prev) => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag] }));
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Guests" description="Persistent guest identity — profiles, VIP tiers and bans."
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4 mr-1" /> Add guest</Button>}
      />

      <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, phone or email…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="banned">Banned</SelectItem></SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-36 text-sm"><ArrowUpDown className="size-3.5 mr-1" /> Sort</SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="visits">Most visits</SelectItem>
            <SelectItem value="lifetime">Highest spend</SelectItem>
            <SelectItem value="lastVisit">Last visit</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showFilters ? "secondary" : "outline"} size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowFilters(!showFilters)} aria-label="More filters">
          <SlidersHorizontal className="size-4" />
          {filterCount > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{filterCount}</span>}
        </Button>
      </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
            <div>
              <Label className="text-[11px]">VIP tier</Label>
              <Select value={vipFilter} onValueChange={setVipFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All tiers</SelectItem><SelectItem value="none">None</SelectItem><SelectItem value="regular">Regular</SelectItem><SelectItem value="vip">VIP</SelectItem><SelectItem value="host-list">Host list</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Tag</Label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All tags</SelectItem>{TAG_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <div className="flex-1"><Label className="text-[11px]">Spend $ min</Label><Input className="mt-1 h-8 text-xs" placeholder="0" value={spendMin} onChange={(e) => setSpendMin(e.target.value)} /></div>
              <div className="flex-1"><Label className="text-[11px]">max</Label><Input className="mt-1 h-8 text-xs" placeholder="∞" value={spendMax} onChange={(e) => setSpendMax(e.target.value)} /></div>
            </div>
            <div className="flex gap-1">
              <div className="flex-1"><Label className="text-[11px]">Visits min</Label><Input className="mt-1 h-8 text-xs" placeholder="0" value={visitsMin} onChange={(e) => setVisitsMin(e.target.value)} /></div>
              <div className="flex-1"><Label className="text-[11px]">max</Label><Input className="mt-1 h-8 text-xs" placeholder="∞" value={visitsMax} onChange={(e) => setVisitsMax(e.target.value)} /></div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {profiles === null ? <ListSkeleton rows={5} rowHeight="h-16" /> : visible.length === 0 ? <EmptyState icon={UserPlus} title="No guests match" description="Profiles are created from reservations, guestlists and door ID checks." /> : (
          <Card><CardContent className="divide-y p-0">
            {visible.map((profile) => (
              <div key={profile.id} className={`flex items-center justify-between gap-2 px-4 py-3 transition-colors ${selected?.id === profile.id ? "bg-accent/60" : "hover:bg-accent/30"}`}>
                <button type="button" onClick={() => { setSelected(profile); setBanReason(""); setMergeTargetId(""); }} className="flex-1 text-left min-w-0">
                  <p className="flex items-center gap-2 font-medium">{profile.displayName}
                    {profile.status === "banned" && <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400 text-[10px]">Banned</Badge>}
                    {profile.vipTier !== "none" && <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] capitalize">{profile.vipTier}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{profile.visitCount} visits · {formatMoney(profile.lifetimeNetCents / 100)} lifetime{profile.lastVisitAt && ` · ${formatDate(profile.lastVisitAt)}`}</p>
                </button>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => openEdit(profile)} aria-label="Edit"><Pencil className="size-3.5" /></Button>
              </div>
            ))}
          </CardContent></Card>
        )}

        {selected && (
          <Card className={selected.status === "banned" ? "border-red-500/40" : undefined}>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{selected.displayName}</p>
                  <p className="text-sm text-muted-foreground">{selected.phone}{selected.phone && selected.email && <><br /></>}{selected.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(selected)} aria-label="Edit"><Pencil className="size-3.5" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Visits</p><p className="font-medium tabular-nums">{selected.visitCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Lifetime</p><p className="font-medium tabular-nums">{formatMoney(selected.lifetimeNetCents / 100)}</p></div>
              </div>
              {selected.tags.length > 0 && <div className="flex flex-wrap gap-1">{selected.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>}
              {selected.notes && <p className="rounded-lg bg-muted/50 p-2.5 text-sm">{selected.notes}</p>}
              {selected.status === "banned" ? (
                <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400"><ShieldOff className="size-4" /> Banned</p>
                  <p className="text-sm text-muted-foreground">{selected.banReason}</p>
                  <ConfirmDialog trigger={<Button variant="outline" className="w-full" disabled={busy}>Lift ban</Button>} title={`Lift ${selected.displayName}'s ban?`} description="They will be admittable at the door again immediately." confirmLabel="Lift ban" onConfirm={() => toggleBan(selected)} />
                </div>
              ) : (
                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="ban-reason">Ban reason</Label>
                  <Textarea id="ban-reason" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Why is this guest being banned?" rows={2} />
                  <ConfirmDialog trigger={<Button variant="destructive" className="w-full" disabled={!banReason.trim() || busy}>Ban this guest</Button>} title={`Ban ${selected.displayName}?`} description="They'll be refused at the door on sight." confirmLabel="Ban guest" destructive onConfirm={() => toggleBan(selected)} />
                </div>
              )}
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="merge-target" className="flex items-center gap-1.5"><Users className="size-3.5" /> Merge into another profile</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger id="merge-target" className="w-full"><SelectValue placeholder="Choose surviving profile" /></SelectTrigger>
                  <SelectContent>{mergeCandidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>)}</SelectContent>
                </Select>
                <ConfirmDialog trigger={<Button variant="outline" className="w-full" disabled={!mergeTargetId || busy}>Merge duplicate</Button>} title="Merge these profiles?" description={`${selected.displayName}'s history folds into the other. Cannot be undone.`} confirmLabel="Merge" onConfirm={mergeInto} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit profile" : "New guest profile"}</DialogTitle><DialogDescription>{editing ? "Update the guest's details." : "Create a profile for a known guest."}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="g-fn">First name *</Label><Input id="g-fn" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label htmlFor="g-ln">Last name</Label><Input id="g-ln" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div><Label htmlFor="g-phone">Phone</Label><Input id="g-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label htmlFor="g-email">Email</Label><Input id="g-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="g-dob">Birth year</Label><Input id="g-dob" value={form.dobYear} onChange={(e) => setForm((p) => ({ ...p, dobYear: e.target.value }))} placeholder="1990" /></div>
              <div><Label htmlFor="g-vip">VIP tier</Label><Select value={form.vipTier} onValueChange={(v) => setForm((p) => ({ ...p, vipTier: v as GuestVipTier }))}><SelectTrigger id="g-vip"><SelectValue /></SelectTrigger><SelectContent>{VIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div>
              <Label>Tags</Label>
              <div className="mt-1 flex flex-wrap gap-1">{TAG_OPTIONS.map((tag) => <Badge key={tag} variant={form.tags.includes(tag) ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => toggleTag(tag)}>{tag}</Badge>)}</div>
            </div>
            <div><Label htmlFor="g-notes">Notes</Label><Textarea id="g-notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            {!editing && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.marketingEmail} onChange={(e) => setForm((p) => ({ ...p, marketingEmail: e.target.checked }))} /> Email consent</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.marketingSms} onChange={(e) => setForm((p) => ({ ...p, marketingSms: e.target.checked }))} /> SMS consent</label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={!form.firstName.trim() || busy}>{editing ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
