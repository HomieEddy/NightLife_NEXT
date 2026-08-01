"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Map, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
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
import { venueService } from "@/features/venue/services";
import { venueKeys } from "@/features/venue/query-keys";
import { zoneStaffHref, zoneTablesHref } from "@/features/shared/entity-links";
import { useHighlight } from "@/lib/use-highlight";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/features/shared/utils";
import { zZoneInput } from "@/lib/form-schemas";
import type { Zone } from "@/lib/types";
import type { z } from "zod";
import { ZONE_COLORS, ZONE_SWATCH as SWATCH } from "@/features/shared/zone-colors";

type FormValues = z.infer<typeof zZoneInput>;
const EMPTY_VALUES: FormValues = { name: "", description: "", color: "violet" as const, capacity: null };

function ZonesContent() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const highlighted = useHighlight();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(zZoneInput),
    defaultValues: EMPTY_VALUES,
  });
  const draftColor = watch("color");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: venueKeys.zones(venueId) });
    queryClient.invalidateQueries({ queryKey: venueKeys.tables(venueId) });
  };

  const { data: zones } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  function openCreate() {
    setEditingId(null);
    reset(EMPTY_VALUES);
    setDialogOpen(true);
  }

  function openEdit(zone: Zone) {
    setEditingId(zone.id);
    reset({ name: zone.name, description: zone.description, color: zone.color as FormValues["color"], capacity: zone.capacity });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const input = { ...data, name: data.name.trim() };
      if (editingId) {
        await venueService.updateZone(editingId, input);
      } else {
        await venueService.createZone(input);
      }
    },
    onSuccess: () => {
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (zone: Zone) => venueService.deleteZone(zone.id),
    onSuccess: (result, zone) => {
      if (!result.ok) {
        toast.error(
          `${zone.name} still has ${result.blockedBy} table${result.blockedBy === 1 ? "" : "s"} — move or delete them first.`,
        );
        return;
      }
      toast.info(`${zone.name} deleted`);
      invalidate();
    },
  });

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

      {zones === undefined ? (
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
                      <TooltipIconButton variant="ghost" tooltip="Edit zone" onClick={() => openEdit(zone)}>
                        <Pencil className="size-4" />
                      </TooltipIconButton>
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
                        onConfirm={() => removeMutation.mutate(zone)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit zone" : "New zone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Name</Label>
              <Input id="zone-name" placeholder="e.g. Rooftop" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-desc">Description</Label>
              <Textarea
                id="zone-desc"
                rows={2}
                placeholder="What kind of seating lives here?"
                {...register("description")}
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
                    onClick={() => setValue("color", color as FormValues["color"])}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform",
                      SWATCH[color],
                      draftColor === color
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
            <Button
              onClick={handleSubmit((data) => saveMutation.mutate(data))}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {saveMutation.isPending ? "Saving…" : editingId ? "Save" : "Create zone"}
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
