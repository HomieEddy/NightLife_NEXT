"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { useAuth } from "@/context/auth-context";
import { incidentService } from "@/features/safety/services";
import { incidentsKeys } from "@/features/safety/query-keys";
import { formatDate, formatTime } from "@/features/shared/format";
import type { Incident, IncidentNote, IncidentType } from "@/lib/types";

export default function ManagerIncidentsPage() {
  const t = useTranslations("manager.incidents");
  const { user } = useAuth();

  const TYPE_LABELS: Record<IncidentType, string> = {
    ejection: t("ejection"),
    "refused-entry": t("refusedEntry"),
    medical: t("medical"),
    altercation: t("altercation"),
    theft: t("theft"),
    "property-damage": t("propertyDamage"),
    police: t("police"),
    "staff-injury": t("staffInjury"),
    other: t("other"),
  };
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, IncidentNote[]>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [regDeadline, setRegDeadline] = useState("");
  const [regAuthority, setRegAuthority] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: incidentsKeys.all(venueId) });

  const { data: incidents } = useQuery({
    queryKey: incidentsKeys.all(venueId),
    queryFn: () => incidentService.listIncidents(),
    enabled: !!venueId,
  });

  const resolveMutation = useMutation({
    mutationFn: (incidentId: string) => incidentService.setStatus(incidentId, "resolved"),
    onSuccess: () => {
      toast.success(t("resolvedToast"));
      invalidate();
    },
    onError: () => toast.error(t("couldNotResolve")),
  });

  const markReportableMutation = useMutation({
    mutationFn: (incidentId: string) => {
      if (!user || !regDeadline || !regAuthority.trim()) {
        throw new Error(t("deadlineRequired"));
      }
      return incidentService.markReportable(incidentId, {
        regulatoryDeadline: regDeadline,
        regulatoryAuthority: regAuthority.trim(),
        staffId: user.id,
        staffName: user.name,
      });
    },
    onSuccess: () => {
      toast.success(t("reportableToast"));
      setRegDeadline("");
      setRegAuthority("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("couldNotMarkReportable")),
  });

  const recordReportedMutation = useMutation({
    mutationFn: (incidentId: string) => {
      if (!user) throw new Error("Not authenticated");
      return incidentService.recordReportedToAuthority(incidentId, user.id, user.name);
    },
    onSuccess: () => {
      toast.success(t("reportedToast"));
      invalidate();
    },
    onError: () => toast.error(t("couldNotRecord")),
  });

  const visible = useMemo(() => {
    return (incidents ?? []).filter((i) => {
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (query.trim() && !i.narrative.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [incidents, typeFilter, severityFilter, statusFilter, query]);

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, typeFilter, severityFilter, statusFilter, reset]);

  async function toggleExpand(incident: Incident) {
    if (expanded === incident.id) {
      setExpanded(null);
      return;
    }
    setExpanded(incident.id);
    setNoteDraft("");
    if (!notes[incident.id]) {
      const list = await incidentService.listNotes(incident.id);
      setNotes((prev) => ({ ...prev, [incident.id]: list }));
    }
  }

  async function addNote(incidentId: string) {
    if (!noteDraft.trim() || !user) return;
    setSaving(true);
    try {
      await incidentService.addNote(incidentId, noteDraft, user.id, user.name);
      setNotes((prev) => ({ ...prev, [incidentId]: [...(prev[incidentId] ?? []), {
        id: `local-${Date.now()}`, incidentId, note: noteDraft.trim(),
        authorStaffId: user.id, authorStaffName: user.name, createdAt: new Date().toISOString(),
      }] }));
      setNoteDraft("");
      toast.success(t("noteAdded"));
    } catch {
      toast.error(t("couldNotAddNote"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={incidents ? t("description", { visible: visible.length, total: incidents.length }) : t("loading")}
        breadcrumbs={[{ label: t("insights"), href: "/manager/reports" }, { label: t("title") }]}
      />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <Input placeholder={t("searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("type")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {(Object.entries(TYPE_LABELS) as [IncidentType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("severity")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="low">{t("low")}</SelectItem>
                <SelectItem value="medium">{t("medium")}</SelectItem>
                <SelectItem value="high">{t("high")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("status")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="open">{t("open")}</SelectItem>
                <SelectItem value="resolved">{t("resolved")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {incidents === undefined ? (
        <ListSkeleton rows={4} rowHeight="h-24" />
      ) : visible.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("noIncidents")} description={t("noIncidentsDesc")} />
      ) : (
        <>
          <div className="space-y-3">
            {sliced.map((incident) => (
              <Card key={incident.id} id={incident.id}>
                <CardContent className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{TYPE_LABELS[incident.type]}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            incident.severity === "high"
                              ? "border-red-500/30 text-red-600 dark:text-red-400"
                              : incident.severity === "medium"
                              ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                              : "border-zinc-500/30 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {incident.severity}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {incident.status === "open" ? t("open") : t("resolved")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{incident.narrative}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {incident.reportedByStaffName} · {formatDate(incident.occurredAt)} {formatTime(incident.occurredAt)}
                        {incident.policeInvolved && ` · ${t("policeInvolved")}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {incident.status === "open" && (
                        <ConfirmDialog
                          trigger={<Button size="sm" variant="outline">{t("resolve")}</Button>}
                          title={`${t("resolve")} ${incident.type.replace(/-/g, " ")}?`}
                          description={t("resolveDesc")}
                          confirmLabel={t("resolveConfirm")}
                          onConfirm={() => resolveMutation.mutate(incident.id)}
                        />
                      )}
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(incident)}>
                        {expanded === incident.id ? t("hide") : t("details")}
                      </Button>
                    </div>
                  </div>

                  {expanded === incident.id && (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-sm">
                        <span className="font-medium">{t("actionsTaken")} </span>
                        {incident.actionsTaken}
                      </p>
                      {incident.reportable && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t("reportTitle")}</p>
                          {incident.regulatoryAuthority && (
                            <p className="text-xs text-muted-foreground">
                              {incident.regulatoryAuthority}
                              {incident.regulatoryDeadline && ` · Deadline: ${formatDate(incident.regulatoryDeadline)}`}
                            </p>
                          )}
                          {incident.reportedToAuthorityAt ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              Reported {formatDate(incident.reportedToAuthorityAt)}
                            </p>
                          ) : (
                            <ConfirmDialog
                              trigger={
                                <Button size="sm" variant="outline" className="mt-1 h-8" disabled={recordReportedMutation.isPending}>
                                  {t("reportConfirm")}
                                </Button>
                              }
                              title={t("reportTitle")}
                              description={`${t("reportConfirm")} — ${incident.regulatoryAuthority ?? "the regulatory authority"}`}
                              confirmLabel={t("reportConfirm")}
                              onConfirm={() => recordReportedMutation.mutate(incident.id)}
                            />
                          )}
                        </div>
                      )}
                      {!incident.reportable && (
                        <div className="space-y-1.5 rounded-lg border px-3 py-2">
                          <p className="text-xs font-medium">{t("reportConfirm")} (S-02)</p>
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={regDeadline}
                              onChange={(e) => setRegDeadline(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder={t("authorityPlaceholder")}
                              value={regAuthority}
                              onChange={(e) => setRegAuthority(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              className="h-8 shrink-0"
                              disabled={markReportableMutation.isPending}
                              onClick={() => markReportableMutation.mutate(incident.id)}
                            >
                              {t("setReportable")}
                            </Button>
                          </div>
                        </div>
                      )}
                      {(notes[incident.id] ?? []).length > 0 && (
                        <ul className="space-y-1.5">
                          {(notes[incident.id] ?? []).map((note) => (
                            <li key={note.id} className="text-sm">
                              <span className="text-xs text-muted-foreground">
                                {note.authorStaffName} · {formatDate(note.createdAt)}
                              </span>
                              <p>{note.note}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={t("notePlaceholder")}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          rows={1}
                          className="min-h-9"
                        />
                        <Button size="sm" disabled={!noteDraft.trim() || saving} onClick={() => addNote(incident.id)}>
                          {t("addNote")}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
        </>
      )}
    </div>
  );
}
