"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ListChecks, Plus, ShieldOff, X } from "lucide-react";
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
import { Pagination, paginate } from "@/components/shared/pagination";
import { incidentService } from "@/features/safety/services";
import { permissionService } from "@/features/platform/permission-service";
import { staffService } from "@/features/workforce/staff-service";
import { canDo } from "@/features/shared/permissions";
import type { RolePermissions } from "@/features/shared/permissions";
import { timeAgo } from "@/features/shared/format";
import type { Incident, IncidentSeverity, IncidentType, StaffMember } from "@/lib/types";

const TYPE_LABELS: Record<IncidentType, string> = {
  ejection: "Ejection",
  "refused-entry": "Refused entry",
  medical: "Medical",
  altercation: "Altercation",
  theft: "Theft",
  "property-damage": "Property damage",
  police: "Police",
  other: "Other",
};

const SEVERITY_TONE: Record<IncidentSeverity, string> = {
  low: "border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
  medium: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  high: "border-red-500/30 text-red-600 dark:text-red-400",
};

export default function StaffIncidentsPage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [reporting, setReporting] = useState(false);

  const [type, setType] = useState<IncidentType>("other");
  const [severity, setSeverity] = useState<IncidentSeverity>("low");
  const [narrative, setNarrative] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [policeInvolved, setPoliceInvolved] = useState(false);
  const [reportable, setReportable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // OE-29/30: escalation + witness + CCTV
  const [escalationLevel, setEscalationLevel] = useState<0 | 1 | 2 | 3>(0);
  const [witnesses, setWitnesses] = useState<{ name: string; contact: string; statement: string }[]>([]);
  const [wName, setWName] = useState("");
  const [wContact, setWContact] = useState("");
  const [wStatement, setWStatement] = useState("");
  const [cctvCamera, setCctvCamera] = useState("");
  // OE-31: medical checklist
  const [ambulanceCalled, setAmbulanceCalled] = useState(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const [currentStaff, perms] = await Promise.all([
      staffService.getCurrentStaff(),
      permissionService.getRolePermissions("venue-1"),
    ]);
    setMe(currentStaff);
    setPermissions(perms);
    const readAll = canDo(perms, currentStaff.role, "incident:read-all");
    const list = await incidentService.listIncidents(readAll ? undefined : { reportedByStaffId: currentStaff.id });
    setIncidents(list);
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => { refresh(); }, [refresh]);

  const canReport = !!(me && permissions && canDo(permissions, me.role, "incident:create"));
  const readAll = !!(me && permissions && canDo(permissions, me.role, "incident:read-all"));

  function resetForm() {
    setType("other");
    setSeverity("low");
    setNarrative("");
    setActionsTaken("");
    setPoliceInvolved(false);
    setReportable(false);
    setEscalationLevel(0);
    setWitnesses([]);
    setCctvCamera("");
    setAmbulanceCalled(false);
  }

  async function submitReport() {
    if (!me || !narrative.trim() || !actionsTaken.trim()) {
      toast.error("Describe what happened and what you did about it.");
      return;
    }
    setSubmitting(true);
    try {
      await incidentService.reportIncident({
        type,
        severity,
        involvedStaffIds: [me.id],
        narrative,
        actionsTaken,
        policeInvolved,
        reportable,
        reportedByStaffId: me.id,
        reportedByStaffName: me.name,
        escalationLevel: escalationLevel > 0 ? escalationLevel : undefined,
        witnesses: witnesses.length > 0 ? witnesses : undefined,
        cctvReference: cctvCamera ? [{ camera: cctvCamera, timestamp: new Date().toISOString() }] : undefined,
        medicalChecklist: ambulanceCalled ? { ambulanceCalled: true, reportFiled: true } : undefined,
      });
      toast.success("Incident filed");
      resetForm();
      setReporting(false);
      await refresh();
    } catch {
      toast.error("Could not file the incident");
    } finally {
      setSubmitting(false);
    }
  }

  if (me && permissions && !canReport && !readAll) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ShieldOff}
          title="Not available for your role"
          description="Ask a manager or security team member to report on your behalf."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display flex items-center gap-2 text-xl">
            <AlertTriangle className="size-5 text-primary" /> Incidents
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {readAll ? "Every incident tonight" : "Incidents you've filed"}
          </p>
        </div>
      </div>

      {canReport && !reporting && (
        <Button className="h-12 w-full text-base" onClick={() => setReporting(true)}>
          <AlertTriangle className="size-4" /> Report an incident
        </Button>
      )}

      {reporting && (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 px-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as IncidentType)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TYPE_LABELS) as [IncidentType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="narrative">What happened</Label>
              <Textarea
                id="narrative"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Where, who was involved, what occurred"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actions">What we did</Label>
              <Textarea
                id="actions"
                value={actionsTaken}
                onChange={(e) => setActionsTaken(e.target.value)}
                placeholder="Actions taken in response"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <p className="text-sm font-medium">Police involved</p>
              <Switch checked={policeInvolved} onCheckedChange={setPoliceInvolved} />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Reportable to authority</p>
                <p className="text-xs text-muted-foreground">Requires filing with a regulatory body</p>
              </div>
              <Switch checked={reportable} onCheckedChange={setReportable} />
            </div>
            <div className="space-y-1.5">
              <Label>Escalation level</Label>
              <Select value={String(escalationLevel)} onValueChange={(v) => setEscalationLevel(Number(v) as 0 | 1 | 2 | 3)}>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">Level 1 — Security lead</SelectItem>
                  <SelectItem value="2">Level 2 — Manager</SelectItem>
                  <SelectItem value="3">Level 3 — Police / external</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Witnesses</Label>
              {witnesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs">
                  <span className="font-medium shrink-0">{w.name}{w.contact ? ` · ${w.contact}` : ""}</span>
                  <span className="text-muted-foreground flex-1 min-w-0">{w.statement}</span>
                  <button onClick={() => setWitnesses((prev) => prev.filter((_, j) => j !== i))} className="shrink-0"><X className="size-3" /></button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={wName} onChange={(e) => setWName(e.target.value)} className="h-9 text-sm" />
                <Input placeholder="Contact" value={wContact} onChange={(e) => setWContact(e.target.value)} className="h-9 text-sm" />
              </div>
              <Input placeholder="Statement" value={wStatement} onChange={(e) => setWStatement(e.target.value)} className="h-9 text-sm" />
              <Button variant="outline" size="sm" onClick={() => { if (wName.trim()) { setWitnesses([...witnesses, { name: wName.trim(), contact: wContact.trim(), statement: wStatement.trim() }]); setWName(""); setWContact(""); setWStatement(""); } }}>
                <Plus className="size-3.5 mr-1" /> Add witness
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cctv">CCTV camera reference</Label>
              <Input id="cctv" value={cctvCamera} onChange={(e) => setCctvCamera(e.target.value)} placeholder="Camera 3, main entrance" className="h-9" />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <p className="text-sm font-medium">Ambulance called</p>
              <Switch checked={ambulanceCalled} onCheckedChange={setAmbulanceCalled} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-12 flex-1" onClick={() => { setReporting(false); resetForm(); }}>
                Cancel
              </Button>
              <ConfirmDialog
                trigger={
                  <Button
                    className="h-12 flex-1 text-base"
                    disabled={!narrative.trim() || !actionsTaken.trim() || submitting}
                  >
                    Submit
                  </Button>
                }
                title="Submit this incident report?"
                description="This creates a permanent record. The narrative can't be edited after submit — add follow-ups as notes instead."
                confirmLabel="Submit report"
                onConfirm={submitReport}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {incidents === null ? (
        <ListSkeleton rows={3} rowHeight="h-20" />
      ) : incidents.length === 0 ? (
        <EmptyState icon={ListChecks} title="No incidents" description="Filed reports will show up here." />
      ) : (
        <div className="space-y-2">
          {paginate(incidents, page).map((incident) => (
            <Card key={incident.id}>
              <CardContent className="space-y-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{TYPE_LABELS[incident.type]}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_TONE[incident.severity]}`}>
                    {incident.severity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{incident.narrative}</p>
                <p className="text-xs text-muted-foreground">
                  {incident.reportedByStaffName} · {timeAgo(incident.occurredAt)} ·{" "}
                  {incident.status === "open" ? "Open" : "Resolved"}
                  {incident.policeInvolved && " · Police involved"}
                  {incident.reportable && " · Reportable to authority"}
                </p>
              </CardContent>
            </Card>
          ))}
          <Pagination totalItems={incidents.length} currentPage={page} onPageChange={setPage} className="mt-3" />
        </div>
      )}
    </div>
  );
}
