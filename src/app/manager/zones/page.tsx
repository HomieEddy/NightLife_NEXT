"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Map, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { venueService } from "@/lib/services/venue-service";
import { zoneStaffHref, zoneTablesHref } from "@/lib/entity-links";
import { useHighlight } from "@/lib/use-highlight";
import { cn } from "@/lib/utils";
import type { Zone, VenueTable } from "@/lib/types";

import { ZONE_COLORS, ZONE_SWATCH as SWATCH } from "@/lib/zone-colors";

type ZoneDraft = { name: string; description: string; color: string };
const EMPTY_DRAFT: ZoneDraft = { name: "", description: "", color: "violet" };

function ZonesContent() {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ZoneDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const highlighted = useHighlight();

  const refresh = useCallback(async () => {
    const [zoneList, tableList] = await Promise.all([
      venueService.listZones(),
      venueService.listTables(),
    ]);
    setZones(zoneList);
    setTables(tableList);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  }

  function openEdit(zone: Zone) {
    setEditingId(zone.id);
    setDraft({ name: zone.name, description: zone.description, color: zone.color });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Zone name is required.");
      return;
    }
    setSaving(true);
    const input = { ...draft, name: draft.name.trim() };
    if (editingId) {
      await venueService.updateZone(editingId, input);
      toast.success(`${input.name} updated`);
    } else {
      await venueService.createZone(input);
      toast.success(`${input.name} created`);
    }
    setSaving(false);
    setDialogOpen(false);
    await refresh();
  }

  async function remove(zone: Zone) {
    const result = await venueService.deleteZone(zone.id);
    if (!result.ok) {
      toast.error(
        `${zone.name} still has ${result.blockedBy} table${result.blockedBy === 1 ? "" : "s"} — move or delete them first.`,
      );
      return;
    }
    toast.info(`${zone.name} deleted`);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Zones"
        description="Zones drive runner routing and analytics segmentation."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New zone
          </Button>
        }
      />

      {zones === null ? (
        <ListSkeleton rows={4} rowHeight="h-28" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {zones.map((zone) => {
            const zoneTables = tables.filter((t) => t.zoneId === zone.id);
            const occupied = zoneTables.filter((t) => t.status === "occupied").length;
            return (
              <Card
                key={zone.id}
                id={`highlight-${zone.id}`}
                className={cn(
                  "py-4 transition-shadow",
                  highlighted === zone.id && "ring-2 ring-primary shadow-lg",
                )}
              >
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-lg border",
                          ZONE_COLORS[zone.color] ?? ZONE_COLORS.violet,
                        )}
                      >
                        <Map className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">{zone.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button variant="ghost" size="icon" aria-label="Edit zone" onClick={() => openEdit(zone)}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                            aria-label="Delete zone"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title={`Delete ${zone.name}?`}
                        description={
                          zoneTables.length > 0
                            ? `This zone still has ${zoneTables.length} tables — deletion will be blocked until they're moved.`
                            : "Staff assignments to this zone will be cleared."
                        }
                        confirmLabel="Delete zone"
                        destructive
                        onConfirm={() => remove(zone)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{zoneTables.length}</span>{" "}
                      tables ·{" "}
                      <span className="font-semibold text-foreground">{occupied}</span> occupied
                    </p>
                    <div className="flex items-center">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={zoneStaffHref(zone.id)}>
                          <Users className="size-3.5" /> Staff
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={zoneTablesHref(zone.id)}>
                          Tables <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------- Create / edit dialog ---------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit zone" : "New zone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Name</Label>
              <Input
                id="zone-name"
                placeholder="e.g. Rooftop"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-desc">Description</Label>
              <Textarea
                id="zone-desc"
                rows={2}
                placeholder="What kind of seating lives here?"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">
                {Object.keys(SWATCH).map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => setDraft({ ...draft, color })}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform",
                      SWATCH[color],
                      draft.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent opacity-60 hover:opacity-100",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Save" : "Create zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManagerZonesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} rowHeight="h-28" />}>
      <ZonesContent />
    </Suspense>
  );
}
