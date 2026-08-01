"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Pencil, ShieldCheck, ShieldPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import { RolesAccessTab } from "@/components/manager/roles-access-tab";
import { ScheduleTab } from "@/components/manager/schedule-tab";
import { CertificationsTab } from "@/components/manager/certifications-tab";
import { StaffEditDialog } from "@/components/manager/staff-edit-dialog";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { staffKeys } from "@/features/workforce/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { useAuth } from "@/context/auth-context";
import { SearchInput } from "@/components/shared/search-input";
import { DateRangePicker, getDefaultDateRange, type DateRangeValue } from "@/components/shared/date-range-picker";
import { isDemoMode } from "@/features/shared/app-mode";
import { cn } from "@/features/shared/utils";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import type { StaffAccountStatus, StaffMember, StaffRole } from "@/lib/types";

const ACCOUNT_BADGE: Record<StaffAccountStatus, { label: string; className: string } | null> = {
  active: null,
  invited: { label: "Invited", className: "border-cyan-500/40 text-cyan-600 dark:text-cyan-400" },
  suspended: { label: "Suspended", className: "border-red-500/40 text-red-600 dark:text-red-400" },
};

function StaffContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [zoneFilter, setZoneFilter] = useState(searchParams.get("zone") ?? "all");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [query, setQuery] = useState("");
  const [scheduleDateRange, setScheduleDateRange] = useState<DateRangeValue>(getDefaultDateRange);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const invalidateStaff = () => queryClient.invalidateQueries({ queryKey: staffKeys.list(venueId) });

  const { data: staff } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const shiftMutation = useMutation({
    mutationFn: (member: StaffMember) => staffService.toggleShift(member.id),
    onSuccess: () => invalidateStaff(),
  });

  const removeMutation = useMutation({
    mutationFn: (member: StaffMember) => staffService.removeStaff(member.id),
    onSuccess: (_, member) => {
      toast.info(`${member.name} removed`);
      invalidateStaff();
    },
  });

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const visible = (staff ?? []).filter((s) => {
    if (zoneFilter !== "all" && !s.assignedZoneIds.includes(zoneFilter)) return false;
    if (roleFilter !== "all" && s.role !== roleFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!`${s.name} ${s.email} ${s.role}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const onShift = visible.filter((s) => s.isOnShift).length;

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, zoneFilter, roleFilter, reset]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff"
        description={staff ? `${visible.length} team members · ${onShift} on shift` : "Loading…"}
        breadcrumbs={[{ label: "Team", href: "/manager/staff" }, { label: "Staff" }]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search staff…"
          className="w-full sm:w-56"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "manager", "bartender", "runner", "host", "promoter"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                roleFilter === r
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "all" ? "All roles" : r}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">
            <Users className="size-3.5" /> Team
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarDays className="size-3.5" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="roles">
            <ShieldCheck className="size-3.5" /> Roles &amp; Access
          </TabsTrigger>
          <TabsTrigger value="certifications">
            <ShieldPlus className="size-3.5" /> Certifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="pt-3">
          {staff === undefined ? (
            <ListSkeleton rows={5} rowHeight="h-20" />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Users}
              title={zoneFilter === "all" ? "No staff yet" : "No staff assigned to this zone"}
              description={zoneFilter === "all" ? "Add your first team member to get started." : undefined}
            />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {sliced.map((member) => {
                  const accountBadge = ACCOUNT_BADGE[member.accountStatus];
                  return (
                    <Card
                      key={member.id}
                      className={cn("py-4", member.accountStatus === "suspended" && "opacity-60")}
                    >
                      <CardContent className="flex items-center gap-3 px-4">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                            {member.avatarInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{member.name}</p>
                            <RoleBadge role={member.role} />
                            {accountBadge && (
                              <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", accountBadge.className)}>
                                {accountBadge.label}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          {member.assignedZoneIds.length > 0 ? (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {member.assignedZoneIds.map((zoneId) => (
                                <EntityChip
                                  key={zoneId}
                                  type="zone-tables"
                                  id={zoneId}
                                  label={zoneName(zoneId)}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="truncate text-xs text-muted-foreground">No zone assigned</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <div className="flex flex-col items-center gap-1">
                            {isDemoMode() ? (
                              <ConfirmDialog
                                trigger={
                                  <Switch checked={member.isOnShift} aria-label="Toggle shift" />
                                }
                                title={
                                  member.isOnShift
                                    ? `Clock ${member.name} out?`
                                    : `Clock ${member.name} in?`
                                }
                                description={
                                  member.isOnShift
                                    ? "They stop receiving orders from their zones."
                                    : "They start receiving orders from their assigned zones."
                                }
                                confirmLabel={member.isOnShift ? "Clock out" : "Clock in"}
                                onConfirm={() => shiftMutation.mutate(member)}
                              />
                            ) : (
                              <span
                                className={`size-2 rounded-full ${member.isOnShift ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                              />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {member.isOnShift ? "On shift" : "Off"}
                            </span>
                          </div>
                          <TooltipIconButton
                            variant="ghost"
                            tooltip="Edit staff"
                            onClick={() => {
                              setEditing(member);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </TooltipIconButton>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                aria-label="Remove"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title={`Remove ${member.name}?`}
                            description="They will lose access to the staff panel and be removed from the schedule."
                            confirmLabel="Remove"
                            destructive
                            onConfirm={() => removeMutation.mutate(member)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
            </>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="pt-3 space-y-4">
          <DateRangePicker value={scheduleDateRange} onChange={setScheduleDateRange} />
          <ScheduleTab staff={staff ?? []} zones={zones} dateRange={scheduleDateRange} />
        </TabsContent>

        <TabsContent value="roles" className="pt-3">
          <RolesAccessTab currentUserRole={me?.role ?? null} venueId={venueId} />
        </TabsContent>

        <TabsContent value="certifications" className="pt-3">
          <CertificationsTab />
        </TabsContent>
      </Tabs>

      <StaffEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={editing}
        zones={zones}
        onDone={invalidateStaff}
      />
    </div>
  );
}

export default function ManagerStaffPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} rowHeight="h-20" />}>
      <StaffContent />
    </Suspense>
  );
}
