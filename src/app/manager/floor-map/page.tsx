"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2, Lock, Map, QrCode, Receipt, Save, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ordersService } from "@/features/ordering/services";
import { guestsService } from "@/features/guests/services";
import { venueService } from "@/features/venue/services";
import { venueKeys } from "@/features/venue/query-keys";
import { ordersKeys } from "@/features/ordering/query-keys";
import { sessionsKeys } from "@/features/guests/query-keys";
import { useAuth } from "@/context/auth-context";
import { ZONE_SWATCH } from "@/features/shared/zone-colors";
import { formatMoney } from "@/features/shared/format";
import { FloorMapCanvas } from "@/components/shared/floor-map-canvas";
import { SessionOverview } from "@/components/shared/session-overview";
import { cn } from "@/features/shared/utils";
import type { GuestSession, Order, TableStatus, VenueTable, Zone, Venue } from "@/lib/types";

const STATUS_NODE: Record<TableStatus, string> = {
  open: "bg-emerald-500/20 border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
  occupied: "bg-fuchsia-500/25 border-fuchsia-500/70 text-fuchsia-700 dark:text-fuchsia-300",
  reserved: "bg-amber-500/20 border-amber-500/60 text-amber-700 dark:text-amber-300",
  closed: "bg-muted border-border text-muted-foreground",
  held: "bg-gray-500/20 border-gray-500/60 text-gray-700 dark:text-gray-300",
  "out-of-service": "bg-gray-500/20 border-gray-500/60 text-gray-700 dark:text-gray-300",
};

const STATUSES: TableStatus[] = ["open", "occupied", "reserved", "closed"];



export default function ManagerFloorMapPage() {
  return (
    <FeatureGate feature="floor-map">
      <FloorMapPageContent />
    </FeatureGate>
  );
}

function FloorMapPageContent() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[] | null>(null);
  const [tableSessions, setTableSessions] = useState<GuestSession[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const snapshotRef = useRef<{ tables: VenueTable[]; floorMap: Venue["floorMap"] } | null>(null);

  const { data: tables } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: venue } = useQuery({
    queryKey: venueKeys.single(venueId),
    queryFn: () => venueService.getVenue(),
    enabled: !!venueId,
  });

  const t = useTranslations("manager.floorMap");

  const CANVAS_PRESETS = [
    { label: t("canvasPresetLabels.wide169"), key: "wide169", width: 16, height: 9 },
    { label: t("canvasPresetLabels.classic43"), key: "classic43", width: 4, height: 3 },
    { label: t("canvasPresetLabels.square11"), key: "square11", width: 1, height: 1 },
    { label: t("canvasPresetLabels.longHall219"), key: "longHall219", width: 21, height: 9 },
  ];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: venueKeys.tables(venueId) });
    queryClient.invalidateQueries({ queryKey: venueKeys.zones(venueId) });
    queryClient.invalidateQueries({ queryKey: venueKeys.single(venueId) });
  };

  const setStatusMutation = useMutation({
    mutationFn: ({ table, status }: { table: VenueTable; status: TableStatus }) =>
      venueService.setTableStatus(table.id, status),
    onSuccess: (_, { table, status }) => {
      toast.success(t("statusChanged", { code: table.code, status }));
      invalidate();
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!tables || !venue) return;
      const snap = snapshotRef.current;
      const movedTables = snap
        ? tables.filter((t) => {
            const orig = snap.tables.find((o) => o.id === t.id);
            return orig && (orig.mapX !== t.mapX || orig.mapY !== t.mapY);
          })
        : [];
      await Promise.all(
        movedTables
          .filter((t): t is VenueTable & { mapX: number; mapY: number } => t.mapX != null && t.mapY != null)
          .map((t) => venueService.setTablePosition(t.id, t.mapX, t.mapY)),
      );
      const canvasChanged = snap && (snap.floorMap.width !== venue.floorMap.width || snap.floorMap.height !== venue.floorMap.height);
      if (canvasChanged) {
        await venueService.updateVenue({ floorMap: venue.floorMap });
      }
    },
    onSuccess: () => {
      snapshotRef.current = null;
      setEditMode(false);
      invalidate();
      toast.success(t("layoutSaved"));
    },
    onError: () => {
      toast.error(t("layoutSaveError"));
    },
  });

  const selected = (tables ?? []).find((t) => t.id === selectedId) ?? null;
  const zoneOf = (zoneId: string) => zones.find((z) => z.id === zoneId);

  // ---------- Edit mode lifecycle ----------

  function enterEditMode() {
    if (!tables || !venue) return;
    snapshotRef.current = {
      tables: tables.map((t) => ({ ...t })),
      floorMap: { ...venue.floorMap },
    };
    setEditMode(true);
  }

  function cancelEdit() {
    const snap = snapshotRef.current;
    if (snap) {
      if (venue) {
        queryClient.setQueryData(venueKeys.tables(venueId), snap.tables);
        queryClient.setQueryData(venueKeys.single(venueId), { ...venue, floorMap: snap.floorMap });
      }
    }
    snapshotRef.current = null;
    setEditMode(false);
    toast.info(t("layoutDiscarded"));
  }

  async function saveEdit() {
    if (!tables || !venue) return;
    setEditSaving(true);
    saveEditMutation.mutate(undefined, { onSettled: () => setEditSaving(false) });
  }

  const hasEditChanges = (() => {
    const snap = snapshotRef.current;
    if (!snap || !tables || !venue) return false;
    if (snap.floorMap.width !== venue.floorMap.width || snap.floorMap.height !== venue.floorMap.height) return true;
    return tables.some((t) => {
      const orig = snap.tables.find((o) => o.id === t.id);
      return orig && (orig.mapX !== t.mapX || orig.mapY !== t.mapY);
    });
  })();

  // ---------- Canvas size (local only in edit mode) ----------

  function setCanvasSize(width: number, height: number) {
    if (!venue) return;
    const floorMap = {
      width: Math.min(40, Math.max(1, width)),
      height: Math.min(40, Math.max(1, height)),
    };
    queryClient.setQueryData(venueKeys.single(venueId), { ...venue, floorMap });
  }

  // ---------- Drag handling (edit mode via dnd-kit) ----------

  function handleTableDrag(tableId: string, mapX: number, mapY: number) {
    if (!tables) return;
    queryClient.setQueryData(
      venueKeys.tables(venueId),
      tables.map((t) => (t.id === tableId ? { ...t, mapX, mapY } : t)),
    );
  }

  function handleSelectTable(table: VenueTable) {
    const next = table.id === selectedId ? null : table.id;
    setSelectedId(next);
    setTableOrders(null);
  }

  // ---------- Inline orders panel (on-demand fetch) ----------

  async function showOrders(table: VenueTable) {
    setOrdersLoading(true);
    const [all, allSessions] = await Promise.all([
      ordersService.listOrders(),
      guestsService.listSessions(),
    ]);
    setTableOrders(all.filter((o) => o.tableId === table.id));
    setTableSessions(allSessions.filter((s) => s.tableId === table.id));
    setOrdersLoading(false);
  }

  if (!tables || !venue) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("title")} description={t("loading")} />
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    );
  }

  const aspect = `${venue.floorMap.width} / ${venue.floorMap.height}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={editMode ? t("layoutMode") : t("liveView")}
        actions={
          editMode ? (
            <div className="flex gap-2">
              {hasEditChanges ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" disabled={editSaving}>
                      <X className="size-4" /> {t("cancel")}
                    </Button>
                  }
                  title={t("discardLayoutTitle")}
                  description={t("discardLayoutDesc")}
                  confirmLabel={t("discardChanges")}
                  destructive
                  onConfirm={cancelEdit}
                />
              ) : (
                <Button variant="ghost" onClick={cancelEdit} disabled={editSaving}>
                  <X className="size-4" /> {t("cancel")}
                </Button>
              )}
              <Button onClick={saveEdit} disabled={editSaving || !hasEditChanges}>
                {editSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editSaving ? t("saving") : t("saveLayout")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={enterEditMode}>
              <Lock className="size-4" /> {t("editLayout")}
            </Button>
          )
        }
      />

      {/* ---------- Canvas size controls (edit mode) ---------- */}
      {editMode && (
        <Card className="py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("canvasShape")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {CANVAS_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setCanvasSize(preset.width, preset.height)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      venue.floorMap.width === preset.width &&
                        venue.floorMap.height === preset.height
                        ? "border-primary bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="canvas-w" className="text-xs">
                  {t("width")}
                </Label>
                <Input
                  id="canvas-w"
                  type="number"
                  min={1}
                  max={40}
                  value={venue.floorMap.width}
                  onChange={(e) => setCanvasSize(Number(e.target.value), venue.floorMap.height)}
                  className="h-8 w-20 tabular-nums"
                />
              </div>
              <span className="pb-1.5 text-muted-foreground">×</span>
              <div className="space-y-1.5">
                <Label htmlFor="canvas-h" className="text-xs">
                  {t("height")}
                </Label>
                <Input
                  id="canvas-h"
                  type="number"
                  min={1}
                  max={40}
                  value={venue.floorMap.height}
                  onChange={(e) => setCanvasSize(venue.floorMap.width, Number(e.target.value))}
                  className="h-8 w-20 tabular-nums"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        {/* ---------- Canvas ---------- */}
        <FloorMapCanvas
          tables={tables}
          zones={zones}
          aspectRatio={aspect}
          selectedId={selectedId}
          editMode={editMode}
          onSelectTable={handleSelectTable}
          onTableDrag={handleTableDrag}
        />

        {/* ---------- Side panel ---------- */}
        <div className="space-y-3">
          {/* Legend */}
          <Card className="py-3">
            <CardContent className="space-y-2 px-4">
              <p className="text-xs font-medium text-muted-foreground">{t("zones")}</p>
              <div className="flex flex-wrap gap-2">
                {zones.map((zone) => (
                  <span key={zone.id} className="flex items-center gap-1.5 text-xs">
                    <span className={cn("size-2 rounded-full", ZONE_SWATCH[zone.color] ?? "bg-muted-foreground")} />
                    {zone.name}
                  </span>
                ))}
              </div>
              <p className="pt-1 text-xs font-medium text-muted-foreground">{t("status")}</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((status) => (
                  <span
                    key={status}
                    className={cn("rounded-md border px-1.5 py-0.5 text-[10px] capitalize", STATUS_NODE[status])}
                  >
                    {status}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected table details */}
          {selected ? (
            <Card className="py-4">
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold">{selected.code}</p>
                    <p className="text-sm text-muted-foreground">{selected.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={selected.status} />
                    <TooltipIconButton
                      variant="ghost"
                      className="size-7"
                      tooltip={t("closeDetails")}
                      onClick={() => {
                        setSelectedId(null);
                        setTableOrders(null);
                      }}
                    >
                      <X className="size-3.5" />
                    </TooltipIconButton>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Users className="size-3.5" />{" "}
                    {t("seats", { count: selected.seats })}
                  </p>
                  {selected.minimumSpend !== null && (
                    <p>{t("minimumSpend", { amount: formatMoney(selected.minimumSpend) })}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {zoneOf(selected.zoneId) && (
                    <EntityChip type="zone" id={selected.zoneId} label={zoneOf(selected.zoneId)!.name} />
                  )}
                  <EntityChip type="zone-staff" id={selected.zoneId} label={t("zoneStaff")} />
                </div>

                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">{t("setStatus")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((status) => (
                      <ConfirmDialog
                        key={status}
                        trigger={
                          <button
                            type="button"
                            disabled={selected.status === status}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                              selected.status === status
                                ? "border-primary bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {status}
                          </button>
                        }
                        title={t("setStatusTitle", { code: selected.code, status })}
                        description={t("setStatusDesc")}
                        confirmLabel={t("setStatusConfirm", { status })}
                        onConfirm={() => setStatusMutation.mutate({ table: selected, status })}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-3">
                  <Button
                    variant={tableOrders !== null ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      tableOrders !== null ? setTableOrders(null) : showOrders(selected)
                    }
                    disabled={ordersLoading}
                  >
                    <Receipt className="size-3.5" />
                    {ordersLoading ? t("loading") : tableOrders !== null ? t("hideOrders") : t("orders")}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href="/manager/qr">
                      <QrCode className="size-3.5" /> QR
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="py-4">
              <CardContent className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
                <Map className="size-6" />
                {editMode ? t("editPrompt") : t("selectPrompt")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ---------- Inline orders for the selected table ---------- */}
      {selected && tableOrders !== null && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {t("ordersSection", { code: selected.code })}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {t("orderCount", {
                  count: tableOrders.length,
                  total: formatMoney(tableOrders.reduce((s, o) => s + o.total, 0)),
                })}
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setTableOrders(null)}>
              <X className="size-3.5" /> {t("close")}
            </Button>
          </div>
            {tableSessions.length > 0 ? (
              <SessionOverview sessions={tableSessions} orders={tableOrders} />
            ) : tableOrders.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={t("noOrdersTitle")}
                description={t("noOrdersDesc")}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {tableOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
        </section>
      )}
    </div>
  );
}
