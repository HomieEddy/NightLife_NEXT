"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, paginate } from "@/components/shared/pagination";
import { auditService } from "@/features/platform/audit-service";
import { staffService } from "@/features/workforce/staff-service";
import { permissionService } from "@/features/platform/permission-service";
import { canDo } from "@/features/shared/permissions";
import { formatDate, formatTime } from "@/features/shared/format";
import type { AuditEntry, StaffMember } from "@/lib/types";

export default function AuditTrailPage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [canRead, setCanRead] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [actorFilter, setActorFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const [currentStaff, permissions] = await Promise.all([
      staffService.getCurrentStaff(),
      permissionService.getRolePermissions("venue-1"),
    ]);
    setMe(currentStaff);
    const allowed = canDo(permissions, currentStaff.role, "audit:read");
    setCanRead(allowed);
    if (allowed) setEntries(await auditService.listEntries());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const actors = useMemo(
    () => Array.from(new Set((entries ?? []).map((e) => e.actorName))).sort(),
    [entries],
  );
  const actions = useMemo(
    () => Array.from(new Set((entries ?? []).map((e) => e.action))).sort(),
    [entries],
  );

  const visible = (entries ?? []).filter((e) => {
    if (actorFilter !== "all" && e.actorName !== actorFilter) return false;
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (query.trim() && !e.summary.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  if (me && !canRead) {
    return (
      <div className="space-y-5">
        <PageHeader title="Audit trail" description="Every sensitive action, by whom and why." />
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
            <ShieldOff className="size-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="font-semibold">Access restricted</p>
          <p className="text-sm text-muted-foreground">Only managers can view the audit trail.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit trail"
        description={entries ? `${visible.length} of ${entries.length} entries` : "Loading…"}
      />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <Input placeholder="Search summaries…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Actor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {actors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {entries === null ? (
        <ListSkeleton rows={5} rowHeight="h-16" />
      ) : visible.length === 0 ? (
        <EmptyState icon={ListChecks} title="No entries match" description="Sensitive actions will appear here as they happen." />
      ) : (
        <>
        <Card>
          <CardContent className="divide-y p-0">
            {paginate(visible, page).map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorName} · {entry.action} · {entry.targetType} {entry.targetId}
                  </p>
                </div>
                <p className="shrink-0 text-right text-xs text-muted-foreground">
                  {formatDate(entry.createdAt)}<br />{formatTime(entry.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Pagination totalItems={visible.length} currentPage={page} onPageChange={setPage} className="mt-3" />
        </>
      )}
    </div>
  );
}
