"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ListChecks, Plus, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { incidentService } from "@/features/safety/services";
import { usePermissions } from "@/features/platform/use-permissions";
import { staffService } from "@/features/workforce/staff-service";
import { incidentsKeys } from "@/features/safety/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { timeAgo } from "@/features/shared/format";
import { zIncidentReportInput } from "@/lib/form-schemas";
import type { Incident, IncidentSeverity, IncidentType } from "@/lib/types";
import type { z } from "zod";

const SEVERITY_TONE: Record<IncidentSeverity, string> = {
  low: "border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
  medium: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  high: "border-red-500/30 text-red-600 dark:text-red-400",
};

export default function StaffIncidentsPage() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const t = useTranslations("staff.incidents");

  const TYPE_LABELS: Record<IncidentType, string> = {
    ejection: t("typeOptions.ejection"),
    "refused-entry": t("typeOptions.refused-entry"),
    medical: t("typeOptions.medical"),
    altercation: t("typeOptions.altercation"),
    theft: t("typeOptions.theft"),
    "property-damage": t("typeOptions.property-damage"),
    police: t("typeOptions.police"),
    "staff-injury": t("typeOptions.staff-injury"),
    other: t("typeOptions.other"),
  };

  const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
    low: t("severityOptions.low"),
    medium: t("severityOptions.medium"),
    high: t("severityOptions.high"),
  };

  type FormValues = z.infer<typeof zIncidentReportInput>;
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(zIncidentReportInput),
    defaultValues: { type: "other" as const, severity: "low" as const, narrative: "", actionsTaken: "", policeInvolved: false, reportable: false },
  });
  const type = watch("type");
  const severity = watch("severity");
  const [escalationLevel, setEscalationLevel] = useState<0 | 1 | 2 | 3>(0);
  const [witnesses, setWitnesses] = useState<{ name: string; contact: string; statement: string }[]>([]);
  const [wName, setWName] = useState("");
  const [wContact, setWContact] = useState("");
  const [wStatement, setWStatement] = useState("");
  const [cctvCamera, setCctvCamera] = useState("");
  const [ambulanceCalled, setAmbulanceCalled] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: incidentsKeys.all(venueId) });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { can, isLoading: permsLoading } = usePermissions();

  const readAll = can("incident:read-all");

  const { data: incidents, isLoading } = useQuery({
    queryKey: incidentsKeys.all(venueId),
    queryFn: () => incidentService.listIncidents(readAll ? undefined : { reportedByStaffId: me!.id }),
    enabled: !!venueId && !!me && !permsLoading,
  });

  const canReport = can("incident:create");

  const { sliced, hasMore, loadMore } = useInfiniteSlice(incidents ?? [], 10);

  function resetForm() {
    reset({ type: "other", severity: "low", narrative: "", actionsTaken: "", policeInvolved: false, reportable: false });
    setEscalationLevel(0);
    setWitnesses([]);
    setCctvCamera("");
    setAmbulanceCalled(false);
  }

  const reportMutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (!me) throw new Error("Not authenticated");
      return incidentService.reportIncident({
        type: data.type,
        severity: data.severity,
        involvedStaffIds: [me.id],
        narrative: data.narrative,
        actionsTaken: data.actionsTaken,
        policeInvolved: data.policeInvolved,
        reportable: data.reportable,
        reportedByStaffId: me.id,
        reportedByStaffName: me.name,
        escalationLevel: escalationLevel > 0 ? escalationLevel : undefined,
        witnesses: witnesses.length > 0 ? witnesses : undefined,
        cctvReference: cctvCamera ? [{ camera: cctvCamera, timestamp: new Date().toISOString() }] : undefined,
        medicalChecklist: ambulanceCalled ? { ambulanceCalled: true, reportFiled: true } : undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("toast.filed"));
      resetForm();
      setReporting(false);
      invalidate();
    },
    onError: () => {
      toast.error(t("toast.fileError"));
    },
  });

  const onSubmitReport = handleSubmit((data) => reportMutation.mutate(data));

  if (!permsLoading && !canReport && !readAll) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ShieldOff}
          title={t("permissionDenied.title")}
          description={t("permissionDenied.description")}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display flex items-center gap-2 text-xl">
            <AlertTriangle className="size-5 text-primary" /> {t("heading")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {readAll ? t("allIncidentsSubtitle") : t("myIncidentsSubtitle")}
          </p>
        </div>
      </div>

      {canReport && !reporting && (
        <Button className="h-12 w-full text-base" onClick={() => setReporting(true)}>
          <AlertTriangle className="size-4" /> {t("reportButton")}
        </Button>
      )}

      {reporting && (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 px-4 pt-4">
            <form onSubmit={onSubmitReport}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("form.typeLabel")}</Label>
                <Select value={type} onValueChange={(v) => setValue("type", v as IncidentType)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TYPE_LABELS) as [IncidentType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("form.severityLabel")}</Label>
                <Select value={severity} onValueChange={(v) => setValue("severity", v as IncidentSeverity)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("severityOptions.low")}</SelectItem>
                    <SelectItem value="medium">{t("severityOptions.medium")}</SelectItem>
                    <SelectItem value="high">{t("severityOptions.high")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="narrative">{t("form.narrativeLabel")}</Label>
              <Textarea id="narrative" {...register("narrative")} placeholder={t("form.narrativePlaceholder")} rows={3} />
              {errors.narrative && <p className="text-xs text-red-600">{errors.narrative.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actions">{t("form.actionsLabel")}</Label>
              <Textarea id="actions" {...register("actionsTaken")} placeholder={t("form.actionsPlaceholder")} rows={2} />
              {errors.actionsTaken && <p className="text-xs text-red-600">{errors.actionsTaken.message}</p>}
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <p className="text-sm font-medium">{t("form.policeInvolvedLabel")}</p>
              <Switch checked={watch("policeInvolved")} onCheckedChange={(v) => setValue("policeInvolved", v)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{t("form.reportableLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("form.reportableDescription")}</p>
              </div>
              <Switch checked={watch("reportable")} onCheckedChange={(v) => setValue("reportable", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("form.escalationLevelLabel")}</Label>
              <Select value={String(escalationLevel)} onValueChange={(v) => setEscalationLevel(Number(v) as 0 | 1 | 2 | 3)}>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("form.escalationOptions.none")}</SelectItem>
                  <SelectItem value="1">{t("form.escalationOptions.level1")}</SelectItem>
                  <SelectItem value="2">{t("form.escalationOptions.level2")}</SelectItem>
                  <SelectItem value="3">{t("form.escalationOptions.level3")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("form.witnessesLabel")}</Label>
              {witnesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs">
                  <span className="font-medium shrink-0">{w.name}{w.contact ? ` · ${w.contact}` : ""}</span>
                  <span className="text-muted-foreground flex-1 min-w-0">{w.statement}</span>
                  <button onClick={() => setWitnesses((prev) => prev.filter((_, j) => j !== i))} className="shrink-0"><X className="size-3" /></button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("form.witnessNamePlaceholder")} value={wName} onChange={(e) => setWName(e.target.value)} className="h-9 text-sm" />
                <Input placeholder={t("form.witnessContactPlaceholder")} value={wContact} onChange={(e) => setWContact(e.target.value)} className="h-9 text-sm" />
              </div>
              <Input placeholder={t("form.witnessStatementPlaceholder")} value={wStatement} onChange={(e) => setWStatement(e.target.value)} className="h-9 text-sm" />
              <Button variant="outline" size="sm" onClick={() => { if (wName.trim()) { setWitnesses([...witnesses, { name: wName.trim(), contact: wContact.trim(), statement: wStatement.trim() }]); setWName(""); setWContact(""); setWStatement(""); } }}>
                <Plus className="size-3.5 mr-1" /> {t("form.addWitnessButton")}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cctv">{t("form.cctvLabel")}</Label>
              <Input id="cctv" value={cctvCamera} onChange={(e) => setCctvCamera(e.target.value)} placeholder={t("form.cctvPlaceholder")} className="h-9" />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <p className="text-sm font-medium">{t("form.ambulanceCalledLabel")}</p>
              <Switch checked={ambulanceCalled} onCheckedChange={setAmbulanceCalled} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" className="h-12 flex-1" onClick={() => { setReporting(false); resetForm(); }}>
                {t("form.cancelButton")}
              </Button>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    className="h-12 flex-1 text-base"
                    disabled={reportMutation.isPending}
                  >
                    {t("form.submitButton")}
                  </Button>
                }
                title={t("confirm.title")}
                description={t("confirm.description")}
                confirmLabel={t("confirm.confirmLabel")}
                onConfirm={onSubmitReport}
              />
            </div>
          </form>
          </CardContent>
        </Card>
      )}

      {isLoading && !incidents ? (
        <ListSkeleton rows={3} rowHeight="h-20" />
      ) : (incidents ?? []).length === 0 ? (
        <EmptyState icon={ListChecks} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <div className="stagger-children space-y-2">
          {sliced.map((incident) => (
            <Card key={incident.id}>
              <CardContent className="space-y-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{TYPE_LABELS[incident.type]}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_TONE[incident.severity]}`}>
                    {SEVERITY_LABELS[incident.severity]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{incident.narrative}</p>
                <p className="text-xs text-muted-foreground">
                  {incident.reportedByStaffName} · {timeAgo(incident.occurredAt)} ·{" "}
                  {incident.status === "open" ? t("statusOpen") : t("statusResolved")}
                  {incident.policeInvolved && ` · ${t("badgePoliceInvolved")}`}
                  {incident.reportable && ` · ${t("badgeReportable")}`}
                </p>
              </CardContent>
            </Card>
          ))}
          <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
        </div>
      )}
    </div>
  );
}
