"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { TableCard } from "@/components/shared/table-card";
import { venueService } from "@/features/venue/services";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination, paginate } from "@/components/shared/pagination";
import { useHighlight } from "@/lib/use-highlight";
import { cn } from "@/features/shared/utils";
import type { TableStatus, VenueTable, Zone } from "@/lib/types";

const STATUSES: TableStatus[] = ["open", "occupied", "reserved", "closed"];

type TableDraft = {
  code: string;
  label: string;
  zoneId: string;
  seats: number;
  minimumSpend: string; // raw input; empty = no minimum
};

function TablesContent() {
  const searchParams = useSearchParams();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<VenueTable[] | null>(null);
  const [zoneFilter, setZoneFilter] = useState(searchParams.get("zone") ?? "all");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TableDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const highlighted = useHighlight();

  const refresh = useCallback(async () => {
    setTables(await venueService.listTables());
  }, []);

  useEffect(() => {
    refresh();
    venueService.listZones().then(setZones);
  }, [refresh]);

  async function setStatus(table: VenueTable, status: TableStatus) {
    await venueService.setTableStatus(table.id, status);
    toast.success(`${table.code} → ${status}`);
    await refresh();
  }

  function openCreate() {
    setEditingId(null);
    setDraft({
      code: "",
      label: "",
      zoneId: zoneFilter !== "all" ? zoneFilter : zones[0]?.id ?? "",
      seats: 4,
      minimumSpend: "",
    });
    setDialogOpen(true);
  }

  function openEdit(table: VenueTable) {
    setEditingId(table.id);
    setDraft({
      code: table.code,
      label: table.label,
      zoneId: table.zoneId,
      seats: table.seats,
      minimumSpend: table.minimumSpend === null ? "" : String(table.minimumSpend),
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft) return;
    if (!draft.code.trim() || !draft.label.trim() || !draft.zoneId) {
      toast.error("Code, label and zone are required.");
      return;
    }
    setSaving(true);
    const input = {
      code: draft.code.trim().toUpperCase(),
      label: draft.label.trim(),
      zoneId: draft.zoneId,
      seats: Math.max(1, draft.seats),
      minimumSpend: draft.minimumSpend === "" ? null : Math.max(0, Number(draft.minimumSpend)),
    };
    if (editingId) {
      await venueService.updateTable(editingId, input);
      toast.success(`${input.code} updated`);
    } else {
      await venueService.createTable({ ...input, status: "open" });
      toast.success(`${input.code} created — QR available on the QR codes page`);
    }
    setSaving(false);
    setDialogOpen(false);
    await refresh();
  }

  async function remove(table: VenueTable) {
    await venueService.deleteTable(table.id);
    toast.info(`${table.code} deleted`);
    await refresh();
  }

  const visible = (tables ?? []).filter((t) => {
    if (zoneFilter !== "all" && t.zoneId !== zoneFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = [t.code, t.label, zoneName(t.zoneId) ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name;
  const zoneChips = (zoneId: string) => {
    const name = zoneName(zoneId);
    if (!name) return undefined;
    return (
      <span className="inline-flex gap-1.5">
        <EntityChip type="zone" id={zoneId} label={name} />
        <EntityChip type="zone-staff" id={zoneId} label="Staff" />
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tables"
        description="Statuses feed the guest QR flow and the floor plan."
        actions={
          <div className="flex items-center gap-2">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New table
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search tables…"
          className="w-full sm:w-56"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {tables === null ? (
        <ListSkeleton rows={6} rowHeight="h-28" />
      ) : visible.length === 0 ? (
        <EmptyState icon={Table2} title="No tables match" description="Try adjusting the filters." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paginate(visible, page).map((table) => (
            <div key={table.id} id={`highlight-${table.id}`}>
            <TableCard
              table={table}
              className={cn(
                "transition-shadow",
                highlighted === table.id && "ring-2 ring-primary shadow-lg",
              )}
              zoneName={zoneChips(table.zoneId)}
              footer={
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((status) => (
                      <ConfirmDialog
                        key={status}
                        trigger={
                          <button
                            type="button"
                            disabled={table.status === status}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                              table.status === status
                                ? "border-primary bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {status}
                          </button>
                        }
                        title={`Set ${table.code} to ${status}?`}
                        description="Table status drives the guest QR flow and runner routing."
                        confirmLabel={`Set ${status}`}
                        onConfirm={() => setStatus(table, status)}
                      />
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Edit table" onClick={() => openEdit(table)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" aria-label="Delete table">
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                      title={`Delete ${table.code}?`}
                      description="Its QR code will stop working. Past orders keep their history."
                      confirmLabel="Delete table"
                      destructive
                      onConfirm={() => remove(table)}
                    />
                  </div>
                </div>
              }
            />
            </div>
          ))}
        </div>
      )}

      <Pagination totalItems={visible.length} currentPage={page} onPageChange={setPage} className="mt-3" />

      {/* ---------- Create / edit dialog ---------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit table" : "New table"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="table-code">Code</Label>
                  <Input
                    id="table-code"
                    placeholder="VIP-07"
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="table-label">Label</Label>
                  <Input
                    id="table-label"
                    placeholder="Booth 7"
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Zone</Label>
                <Select
                  value={draft.zoneId}
                  onValueChange={(zoneId) => setDraft({ ...draft, zoneId })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="table-seats">Seats</Label>
                  <Input
                    id="table-seats"
                    type="number"
                    min={1}
                    value={draft.seats}
                    onChange={(e) => setDraft({ ...draft, seats: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="table-min">Min. spend ($)</Label>
                  <Input
                    id="table-min"
                    type="number"
                    min={0}
                    step={50}
                    placeholder="None"
                    value={draft.minimumSpend}
                    onChange={(e) => setDraft({ ...draft, minimumSpend: e.target.value })}
                  />
                </div>
              </div>
              {!editingId && (
                <p className="text-xs text-muted-foreground">
                  A QR code is generated automatically from the table code.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Save" : "Create table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManagerTablesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} rowHeight="h-28" />}>
      <TablesContent />
    </Suspense>
  );
}
