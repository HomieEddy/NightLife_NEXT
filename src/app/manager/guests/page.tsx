"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Plus, Search, ShieldOff, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { guestService } from "@/features/sessions/services";
import { profilesKeys } from "@/features/sessions/query-keys";
import { formatMoney, formatDate } from "@/features/shared/format";
import { useAuth } from "@/context/auth-context";
import { zGuestInput } from "@/lib/form-schemas";
import type { GuestProfile, GuestTag, GuestVipTier } from "@/lib/types";
import type { z } from "zod";

type FormValues = z.infer<typeof zGuestInput>;

const TAG_OPTIONS: GuestTag[] = ["regular", "industry", "influencer", "birthday", "allergy-noted", "high-spender"];

export default function ManagerGuestsPage() {
  const t = useTranslations("manager.guests");
  const { user } = useAuth();
  const VIP_OPTIONS: { value: GuestVipTier; label: string }[] = [
    { value: "none", label: t("none") }, { value: "regular", label: t("regular") }, { value: "vip", label: t("vip") }, { value: "host-list", label: t("hostList") },
  ];
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<GuestProfile | null>(null);
  const [banReason, setBanReason] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
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

  const { register, handleSubmit, reset: formReset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(zGuestInput),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", vipTier: "none" as GuestVipTier, tags: [] as GuestTag[], notes: "", photoUrl: "", preferredDrink: "", dietary: "", allergies: "", celebrationDate: "", watchlistReason: "", marketingEmail: false, marketingSms: false },
  });
  const tags = watch("tags") ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: profilesKeys.all(venueId) });

  const { data: profiles } = useQuery({
    queryKey: profilesKeys.all(venueId),
    queryFn: () => guestService.listProfiles(),
    enabled: !!venueId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const prefs = data.preferredDrink || data.dietary || data.allergies || data.celebrationDate
        ? { preferredDrink: data.preferredDrink || undefined, dietary: data.dietary || undefined, allergies: data.allergies || undefined, celebrationDate: data.celebrationDate || undefined }
        : undefined;
      if (editing) {
        await guestService.updateProfile(editing.id, {
          firstName: data.firstName.trim(), lastName: data.lastName.trim() || undefined,
          phone: data.phone.trim() || undefined, email: data.email?.trim().toLowerCase() || undefined,
          dobYear: data.dobYear, tags: data.tags as GuestTag[], vipTier: data.vipTier,
          notes: data.notes.trim() || undefined, photoUrl: data.photoUrl.trim() || undefined, preferences: prefs,
        }, "manager", "Manager");
        return `Updated ${data.firstName}`;
      } else {
        await guestService.createProfile({
          firstName: data.firstName.trim(), lastName: data.lastName.trim() || undefined,
          phone: data.phone.trim() || undefined, email: data.email?.trim().toLowerCase() || undefined,
          dobYear: data.dobYear, tags: data.tags as GuestTag[], vipTier: data.vipTier,
          notes: data.notes.trim() || undefined, marketingConsent: { email: data.marketingEmail, sms: data.marketingSms },
          source: "manager", photoUrl: data.photoUrl.trim() || undefined, preferences: prefs,
        });
        return `Created profile for ${data.firstName}`;
      }
    },
    onSuccess: (message) => {
      toast.success(message);
      setDialogOpen(false);
      invalidate();
    },
    onError: () => toast.error(t("couldNotSave")),
  });

  const banMutation = useMutation({
    mutationFn: (profile: GuestProfile) =>
      guestService.setBanStatus(profile.id, { banned: profile.status !== "banned", reason: banReason || undefined }, "manager", "Manager"),
    onSuccess: (_, profile) => {
      toast.success(profile.status === "banned" ? `Lifted ban on ${profile.displayName}` : `Banned ${profile.displayName}`);
      setBanReason("");
      invalidate();
    },
    onError: () => toast.error(t("couldNotBan")),
  });

  const mergeMutation = useMutation({
    mutationFn: () => {
      if (!selected || !mergeTargetId) throw new Error("Select a target");
      return guestService.mergeProfiles(selected.id, mergeTargetId, "manager", "Manager");
    },
    onSuccess: (merged) => {
      toast.success(`Merged into ${merged?.displayName}`);
      setSelected(null);
      setMergeTargetId("");
      invalidate();
    },
    onError: () => toast.error(t("couldNotMerge")),
  });

  const onSave = handleSubmit((data) => saveMutation.mutate(data));

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
    if (sortBy === "name") list = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    else if (sortBy === "visits") list = [...list].sort((a, b) => b.visitCount - a.visitCount);
    else if (sortBy === "lifetime") list = [...list].sort((a, b) => b.lifetimeNetCents - a.lifetimeNetCents);
    else if (sortBy === "lastVisit") list = [...list].sort((a, b) => (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
    return list;
  }, [profiles, query, statusFilter, vipFilter, tagFilter, spendMin, spendMax, visitsMin, visitsMax, sortBy]);

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, statusFilter, vipFilter, tagFilter, spendMin, spendMax, visitsMin, visitsMax, sortBy, reset]);

  const filterCount = [vipFilter !== "all", tagFilter !== "all", spendMin || spendMax, visitsMin || visitsMax].filter(Boolean).length;
  const mergeCandidates = (profiles ?? []).filter((p) => p.id !== selected?.id);

  function openCreate() {
    setEditing(null);
    formReset({ firstName: "", lastName: "", phone: "", email: "", vipTier: "none", tags: [], notes: "", photoUrl: "", preferredDrink: "", dietary: "", allergies: "", celebrationDate: "", watchlistReason: "", marketingEmail: false, marketingSms: false });
    setDialogOpen(true);
  }

  function openEdit(profile: GuestProfile) {
    setEditing(profile);
    formReset({
      firstName: profile.firstName, lastName: profile.lastName ?? "", phone: profile.phone ?? "", email: profile.email ?? "",
      dobYear: profile.dobYear, vipTier: profile.vipTier, tags: profile.tags, notes: profile.notes ?? "",
      marketingEmail: profile.marketingConsent.email, marketingSms: profile.marketingConsent.sms,
      photoUrl: profile.photoUrl ?? "",
      preferredDrink: profile.preferences?.preferredDrink ?? "",
      dietary: profile.preferences?.dietary ?? "",
      allergies: profile.preferences?.allergies ?? "",
      celebrationDate: profile.preferences?.celebrationDate ?? "",
      watchlistReason: profile.watchlist?.reason ?? "",
    });
    setDialogOpen(true);
  }

  function toggleTag(tag: GuestTag) {
    setValue("tags", tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")}
        breadcrumbs={[{ label: t("bookings"), href: "/manager/reservations" }, { label: t("title") }]}
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4 mr-1" /> {t("addGuest")}</Button>}
      />

      <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("all")}</SelectItem><SelectItem value="active">{t("active")}</SelectItem><SelectItem value="banned">{t("banned")}</SelectItem></SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-36 text-sm"><ArrowUpDown className="size-3.5 mr-1" /> {t("sort")}</SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("sortByName")}</SelectItem>
            <SelectItem value="visits">{t("sortByVisits")}</SelectItem>
            <SelectItem value="lifetime">{t("sortBySpend")}</SelectItem>
            <SelectItem value="lastVisit">{t("sortByLastVisit")}</SelectItem>
          </SelectContent>
        </Select>
        <TooltipIconButton variant={showFilters ? "secondary" : "outline"} className="h-9 w-9 shrink-0" onClick={() => setShowFilters(!showFilters)} tooltip={t("moreFilters")}>
          <SlidersHorizontal className="size-4" />
          {filterCount > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{filterCount}</span>}
        </TooltipIconButton>
      </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">{t("vipTierFilter")}</Label>
              <Select value={vipFilter} onValueChange={setVipFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("allTiers")}</SelectItem>{VIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("tagFilter")}</Label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("allTags")}</SelectItem>{TAG_OPTIONS.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <div className="flex-1"><Label className="text-xs">{t("spendMin")}</Label><Input className="mt-1 h-8 text-xs" placeholder="0" value={spendMin} onChange={(e) => setSpendMin(e.target.value)} /></div>
              <div className="flex-1"><Label className="text-xs">{t("max")}</Label><Input className="mt-1 h-8 text-xs" placeholder="∞" value={spendMax} onChange={(e) => setSpendMax(e.target.value)} /></div>
            </div>
            <div className="flex gap-1">
              <div className="flex-1"><Label className="text-xs">{t("visitsMin")}</Label><Input className="mt-1 h-8 text-xs" placeholder="0" value={visitsMin} onChange={(e) => setVisitsMin(e.target.value)} /></div>
              <div className="flex-1"><Label className="text-xs">{t("max")}</Label><Input className="mt-1 h-8 text-xs" placeholder="∞" value={visitsMax} onChange={(e) => setVisitsMax(e.target.value)} /></div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {profiles === undefined ? <ListSkeleton rows={5} rowHeight="h-16" /> : visible.length === 0 ? <EmptyState icon={UserPlus} title={t("noGuestsMatch")} description={t("noGuestsDesc")} /> : (
          <>
          <Card><CardContent className="divide-y p-0">
            {sliced.map((profile) => (
              <div key={profile.id} className={`flex items-center justify-between gap-2 px-4 py-3 transition-colors ${selected?.id === profile.id ? "bg-accent/60" : "hover:bg-accent/30"}`}>
                <button type="button" onClick={() => { setSelected(profile); setBanReason(""); setMergeTargetId(""); }} className="flex-1 text-left min-w-0">
                   <p className="flex items-center gap-2 font-medium">{profile.displayName}
                    {profile.status === "banned" && <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400 text-[10px]">{t("bannedBadge")}</Badge>}
                    {profile.watchlist && <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px]">{t("watchlistBadge")}</Badge>}
                    {profile.vipTier !== "none" && <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] capitalize">{profile.vipTier}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("visitsStat", { count: profile.visitCount })} · {t("lifetimeStat", { amount: formatMoney(profile.lifetimeNetCents / 100) })}{profile.lastVisitAt && ` · ${formatDate(profile.lastVisitAt)}`}{profile.valueScore != null ? ` · Score ${profile.valueScore}` : ""}</p>
                </button>
                <TooltipIconButton variant="ghost" className="size-7 shrink-0" onClick={() => openEdit(profile)} tooltip={t("edit")}><Pencil className="size-3.5" /></TooltipIconButton>
              </div>
            ))}
          </CardContent></Card>
          <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
          </>
        )}

        {selected && (
          <Card className={selected.status === "banned" ? "border-red-500/40" : undefined}>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{selected.displayName}</p>
                  <p className="text-sm text-muted-foreground">{selected.phone}{selected.phone && selected.email && <><br /></>}{selected.email}</p>
                </div>
                <TooltipIconButton variant="ghost" className="size-7" onClick={() => openEdit(selected)} tooltip={t("edit")}><Pencil className="size-3.5" /></TooltipIconButton>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">{t("visitsLabel")}</p><p className="font-medium tabular-nums">{selected.visitCount}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("lifetimeLabel")}</p><p className="font-medium tabular-nums">{formatMoney(selected.lifetimeNetCents / 100)}</p></div>
              </div>
              {selected.tags.length > 0 && <div className="flex flex-wrap gap-1">{selected.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>}
              {selected.notes && <p className="rounded-lg bg-muted/50 p-2.5 text-sm">{selected.notes}</p>}
              {selected.status === "banned" ? (
                <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400"><ShieldOff className="size-4" /> {t("bannedStatus")}</p>
                  <p className="text-sm text-muted-foreground">{selected.banReason}</p>
                  <ConfirmDialog trigger={<Button variant="outline" className="w-full">{t("liftBan")}</Button>} title={t("liftBanTitle", { name: selected.displayName })} description={t("liftBanDesc")} confirmLabel={t("liftBanConfirm")} onConfirm={() => banMutation.mutate(selected)} />
                </div>
              ) : (
                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="ban-reason">{t("banReasonLabel")}</Label>
                  <Textarea id="ban-reason" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder={t("banReasonPlaceholder")} rows={2} />
                  <ConfirmDialog trigger={<Button variant="destructive" className="w-full" disabled={!banReason.trim()}>{t("banGuest")}</Button>} title={t("banTitle", { name: selected.displayName })} description={t("banDesc")} confirmLabel={t("banConfirm")} destructive onConfirm={() => banMutation.mutate(selected)} />
                </div>
              )}
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="merge-target" className="flex items-center gap-1.5"><Users className="size-3.5" /> {t("mergeIntoProfile")}</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger id="merge-target" className="w-full"><SelectValue placeholder={t("chooseProfile")} /></SelectTrigger>
                  <SelectContent>{mergeCandidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>)}</SelectContent>
                </Select>
                <ConfirmDialog trigger={<Button variant="outline" className="w-full" disabled={!mergeTargetId}>{t("mergeDuplicate")}</Button>} title={t("mergeTitle")} description={t("mergeDesc", { name: selected.displayName })} confirmLabel={t("mergeConfirm")} onConfirm={() => mergeMutation.mutate()} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? t("editProfile") : t("newProfile")}</DialogTitle><DialogDescription>{editing ? t("editProfileDesc") : t("newProfileDesc")}</DialogDescription></DialogHeader>
          <form onSubmit={onSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="g-fn">{t("firstName")}</Label><Input id="g-fn" {...register("firstName")} />{errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}</div>
              <div><Label htmlFor="g-ln">{t("lastName")}</Label><Input id="g-ln" {...register("lastName")} /></div>
            </div>
            <div><Label htmlFor="g-phone">{t("phone")}</Label><Input id="g-phone" {...register("phone")} /></div>
            <div><Label htmlFor="g-email">{t("email")}</Label><Input id="g-email" type="email" {...register("email")} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="g-dob">{t("birthYear")}</Label><Input id="g-dob" type="number" min={1900} max={2026} placeholder="1990" {...register("dobYear", { valueAsNumber: true })} />{errors.dobYear && <p className="text-xs text-destructive">{errors.dobYear.message}</p>}</div>
              <div><Label htmlFor="g-vip">{t("vipTierLabel")}</Label><Select value={watch("vipTier")} onValueChange={(v) => setValue("vipTier", v as GuestVipTier)}><SelectTrigger id="g-vip"><SelectValue /></SelectTrigger><SelectContent>{VIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div>
              <Label>{t("tags")}</Label>
              <div className="mt-1 flex flex-wrap gap-1">{TAG_OPTIONS.map((tag) => <Badge key={tag} variant={tags.includes(tag) ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => toggleTag(tag)}>{tag}</Badge>)}</div>
            </div>
            <div><Label htmlFor="g-notes">{t("notes")}</Label><Textarea id="g-notes" {...register("notes")} rows={2} /></div>
            <div><Label htmlFor="g-photo">{t("photoUrl")}</Label><Input id="g-photo" {...register("photoUrl")} placeholder={t("photoUrlPlaceholder")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="g-drink">{t("prefDrink")}</Label><Input id="g-drink" {...register("preferredDrink")} /></div>
              <div><Label htmlFor="g-dietary">{t("dietary")}</Label><Input id="g-dietary" {...register("dietary")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="g-allergies">{t("allergies")}</Label><Input id="g-allergies" {...register("allergies")} /></div>
              <div><Label htmlFor="g-celebration">{t("celebrationDate")}</Label><Input id="g-celebration" type="date" {...register("celebrationDate")} /></div>
            </div>
            <div><Label htmlFor="g-watchlist">{t("watchlistReason")}</Label><Input id="g-watchlist" {...register("watchlistReason")} placeholder={t("watchlistPlaceholder")} /></div>
            {!editing && (
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={watch("marketingEmail")} onCheckedChange={(v) => setValue("marketingEmail", v)} id="g-email-consent" />
                  <Label htmlFor="g-email-consent" className="text-sm">{t("emailConsent")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={watch("marketingSms")} onCheckedChange={(v) => setValue("marketingSms", v)} id="g-sms-consent" />
                  <Label htmlFor="g-sms-consent" className="text-sm">{t("smsConsent")}</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? t("saveChanges") : t("create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
