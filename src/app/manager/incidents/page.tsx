"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, paginate } from "@/components/shared/pagination";
import { useAuth } from "@/context/auth-context";
import { incidentService } from "@/lib/services/incident-service";
import { formatDate, formatTime } from "@/lib/format";
import type { Incident, IncidentNote, IncidentSeverity, IncidentType } from "@/lib/types";

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

export default function ManagerIncidentsPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, IncidentNote[]>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setIncidents(await incidentService.listIncidents());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const visible = useMemo(() => {
    return (incidents ?? []).filter((i) => {
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (query.trim() && !i.narrative.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [incidents, typeFilter, severityFilter, statusFilter, query]);

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
      toast.success("Note added");
    } catch {
      toast.error("Could not add the note");
    } finally {
      setSaving(false);
    }
  }

  async function resolveIncident(incidentId: string) {
    await incidentService.setStatus(incidentId, "resolved");
    toast.success("Incident marked resolved");
    await refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidents"
        description={incidents ? `${visible.length} of ${incidents.length} incidents` : "Loading…"}
      />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <Input placeholder="Search narratives…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(Object.entries(TYPE_LABELS) as [IncidentType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {incidents === null ? (
        <ListSkeleton rows={4} rowHeight="h-24" />
      ) : visible.length === 0 ? (
        <EmptyState icon={ListChecks} title="No incidents match" description="Filed reports will appear here." />
      ) : (
        <>
        <div className="space-y-3">
          {paginate(visible, page).map((incident) => (
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
                        {incident.status === "open" ? "Open" : "Resolved"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{incident.narrative}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {incident.reportedByStaffName} · {formatDate(incident.occurredAt)} {formatTime(incident.occurredAt)}
                      {incident.policeInvolved && " · Police involved"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {incident.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => resolveIncident(incident.id)}>
                        Resolve
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleExpand(incident)}>
                      {expanded === incident.id ? "Hide" : "Details"}
                    </Button>
                  </div>
                </div>

                {expanded === incident.id && (
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-sm">
                      <span className="font-medium">Actions taken: </span>
                      {incident.actionsTaken}
                    </p>
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
                        placeholder="Add a follow-up note…"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={1}
                        className="min-h-9"
                      />
                      <Button size="sm" disabled={!noteDraft.trim() || saving} onClick={() => addNote(incident.id)}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination totalItems={visible.length} currentPage={page} onPageChange={setPage} className="mt-3" />
        </>
      )}
    </div>
  );
}
