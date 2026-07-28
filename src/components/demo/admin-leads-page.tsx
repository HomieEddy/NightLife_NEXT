"use client";

// Plan 10 graduates this demo-only surface.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Columns3, Filter, List, Loader2, Pencil, Plus, Rocket, Search, Send, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { adminService } from "@/features/platform/admin-service";
import { formatMoney, timeAgo } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { Lead, LeadSource, LeadStatus } from "@/lib/types";

const PIPELINE: LeadStatus[] = ["new", "contacted", "demo", "negotiating", "won", "lost"];

const SOURCE_LABEL: Record<LeadSource, string> = {
  "landing-page": "Landing page",
  referral: "Referral",
  outbound: "Outbound",
  event: "Event",
};

interface LeadDraft {
  venueName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  source: LeadSource;
  dealValue: number;
  notes: string;
}

const EMPTY_DRAFT: LeadDraft = {
  venueName: "",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  source: "outbound",
  dealValue: 2988,
  notes: "",
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | LeadSource>("all");

  // Add/edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LeadDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Detail dialog
  const [detailId, setDetailId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  const refresh = useCallback(async () => {
    setLeads(await adminService.listLeads());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    return (leads ?? []).filter((lead) => {
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (
          ![lead.venueName, lead.contactName, lead.email, lead.city]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      return true;
    });
  }, [leads, query, sourceFilter]);

  const detail = (leads ?? []).find((l) => l.id === detailId) ?? null;
  const openPipelineValue = visible
    .filter((l) => !["won", "lost"].includes(l.status))
    .reduce((s, l) => s + l.dealValue, 0);

  // ---------- Actions ----------

  async function setStatus(lead: Lead, status: LeadStatus) {
    await adminService.setLeadStatus(lead.id, status);
    toast.success(`${lead.venueName} → ${status}`);
    await refresh();
  }

  function moveStage(lead: Lead, direction: 1 | -1) {
    const activeStages = PIPELINE.slice(0, 4); // won/lost are exits, not steps
    const index = activeStages.indexOf(lead.status);
    if (index === -1) return;
    const next = activeStages[index + direction];
    if (next) setStatus(lead, next);
  }

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingId(lead.id);
    setDraft({
      venueName: lead.venueName,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      source: lead.source,
      dealValue: lead.dealValue,
      notes: lead.notes,
    });
    setFormOpen(true);
  }

  async function saveDraft() {
    if (!draft.venueName.trim() || !draft.contactName.trim() || !draft.email.trim()) {
      toast.error("Venue, contact and email are required.");
      return;
    }
    setSaving(true);
    const input = {
      ...draft,
      venueName: draft.venueName.trim(),
      contactName: draft.contactName.trim(),
      email: draft.email.trim().toLowerCase(),
      dealValue: Math.max(0, draft.dealValue),
    };
    if (editingId) {
      await adminService.updateLead(editingId, input);
      toast.success(`${input.venueName} updated`);
    } else {
      await adminService.createLead(input);
      toast.success(`${input.venueName} added to the pipeline`);
    }
    setSaving(false);
    setFormOpen(false);
    await refresh();
  }

  async function remove(lead: Lead) {
    await adminService.deleteLead(lead.id);
    if (detailId === lead.id) setDetailId(null);
    toast.info(`${lead.venueName} removed from the pipeline`);
    await refresh();
  }

  async function addNote() {
    if (!detail || !note.trim()) return;
    setSendingNote(true);
    await adminService.addLeadNote(detail.id, note.trim());
    setNote("");
    setSendingNote(false);
    await refresh();
  }

  // ---------- Card ----------

  function LeadCard({ lead, showStage = false }: { lead: Lead; showStage?: boolean }) {
    const isActive = !["won", "lost"].includes(lead.status);
    return (
      <Card
        className="cursor-pointer py-3 transition-colors hover:border-primary/50"
        onClick={() => setDetailId(lead.id)}
      >
        <CardContent className="space-y-1.5 px-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{lead.venueName}</p>
            {showStage && <StatusBadge status={lead.status} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {lead.contactName} · {lead.city}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tabular-nums text-primary">
              {formatMoney(lead.dealValue)}
            </span>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {SOURCE_LABEL[lead.source]}
            </Badge>
          </div>
          {isActive && !showStage && (
            <div
              className="flex justify-between border-t pt-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Move back"
                disabled={lead.status === "new"}
                onClick={() => moveStage(lead, -1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground">{timeAgo(lead.createdAt)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Move forward"
                disabled={lead.status === "negotiating"}
                onClick={() => moveStage(lead, 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lead pipeline"
        description={
          leads
            ? `${visible.length} leads · ${formatMoney(openPipelineValue)} open pipeline`
            : "Loading…"
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5">
              {(
                [
                  { id: "board", icon: Columns3, label: "Board" },
                  { id: "list", icon: List, label: "List" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    view === v.id ? "bg-primary/15 text-primary" : "text-muted-foreground",
                  )}
                >
                  <v.icon className="size-3.5" /> {v.label}
                </button>
              ))}
            </div>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add lead
            </Button>
          </div>
        }
      />

      {/* ---------- Filters ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search venue, contact, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABEL[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {leads === null ? (
        <ListSkeleton rows={5} rowHeight="h-28" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No leads match"
          description="Loosen the filters or add a lead manually."
        />
      ) : view === "board" ? (
        /* ---------- Board view ---------- */
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="grid min-w-[900px] grid-cols-6 gap-2">
            {PIPELINE.map((stage) => {
              const stageLeads = visible.filter((l) => l.status === stage);
              const stageValue = stageLeads.reduce((s, l) => s + l.dealValue, 0);
              return (
                <div key={stage} className="space-y-2">
                  <div
                    className={cn(
                      "rounded-lg border p-2 text-center",
                      stage === "won" && "border-emerald-500/40",
                      stage === "lost" && "border-red-500/30 opacity-70",
                    )}
                  >
                    <p className="text-xs font-semibold capitalize">{stage}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stageLeads.length} · {formatMoney(stageValue)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ---------- List view ---------- */
        <div className="space-y-2">
          {visible.map((lead) => (
            <LeadCard key={lead.id} lead={lead} showStage />
          ))}
        </div>
      )}

      {/* ---------- Add / edit dialog ---------- */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit lead" : "Add a lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-venue">Venue</Label>
                <Input
                  id="lead-venue"
                  value={draft.venueName}
                  onChange={(e) => setDraft({ ...draft, venueName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-city">City</Label>
                <Input
                  id="lead-city"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-contact">Contact</Label>
                <Input
                  id="lead-contact"
                  value={draft.contactName}
                  onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select
                  value={draft.source}
                  onValueChange={(v) => setDraft({ ...draft, source: v as LeadSource })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((source) => (
                      <SelectItem key={source} value={source}>
                        {SOURCE_LABEL[source]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-value">Deal value ($/yr)</Label>
                <Input
                  id="lead-value"
                  type="number"
                  min={0}
                  step={100}
                  value={draft.dealValue}
                  onChange={(e) => setDraft({ ...draft, dealValue: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Save" : "Add lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Detail dialog ---------- */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.venueName} <StatusBadge status={detail.status} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <p className="text-muted-foreground">Contact</p>
                  <p>{detail.contactName}</p>
                  <p className="text-muted-foreground">Email</p>
                  <p className="truncate">{detail.email}</p>
                  <p className="text-muted-foreground">Phone</p>
                  <p>{detail.phone || "—"}</p>
                  <p className="text-muted-foreground">City</p>
                  <p>{detail.city}</p>
                  <p className="text-muted-foreground">Source</p>
                  <p>{SOURCE_LABEL[detail.source]}</p>
                  <p className="text-muted-foreground">Deal value</p>
                  <p className="font-semibold tabular-nums text-primary">
                    {formatMoney(detail.dealValue)}/yr
                  </p>
                </div>

                {detail.notes && (
                  <p className="rounded-lg bg-accent/50 p-3 text-sm text-muted-foreground">
                    “{detail.notes}”
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={detail.status}
                    onValueChange={(value) => setStatus(detail, value as LeadStatus)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE.map((stage) => (
                        <SelectItem key={stage} value={stage} className="capitalize">
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => openEdit(detail)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    }
                    title={`Delete ${detail.venueName}?`}
                    description="The lead and its activity history are removed from the pipeline."
                    confirmLabel="Delete lead"
                    destructive
                    onConfirm={() => remove(detail)}
                  />
                  {detail.status === "won" && (
                    <Button size="sm" asChild>
                      <Link href={`/admin/onboarding?lead=${detail.id}`}>
                        <Rocket className="size-3.5" /> Provision tenant
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Activity log */}
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-medium">Activity</p>
                  <ul className="space-y-2">
                    {[...detail.activity].reverse().map((entry) => (
                      <li key={entry.id} className="flex gap-2 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                        <div className="min-w-0">
                          <p>{entry.text}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(entry.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Log a call, email or next step…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addNote()}
                    />
                    <Button
                      size="icon"
                      onClick={addNote}
                      disabled={sendingNote || !note.trim()}
                      aria-label="Add note"
                    >
                      {sendingNote ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
