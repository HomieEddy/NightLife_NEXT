"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Inbox, Lock, LockOpen, Map, QrCode, Receipt, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ordersService } from "@/lib/services/orders-service";
import { guestsService } from "@/lib/services/guests-service";
import { venueService } from "@/lib/services/venue-service";
import { ZONE_SWATCH } from "@/lib/zone-colors";
import { formatMoney } from "@/lib/format";
import { SessionOverview } from "@/components/shared/session-overview";
import { cn } from "@/lib/utils";
import type { GuestSession, Order, TableStatus, Venue, VenueTable, Zone } from "@/lib/types";

const STATUS_NODE: Record<TableStatus, string> = {
  open: "bg-emerald-500/20 border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
  occupied: "bg-fuchsia-500/25 border-fuchsia-500/70 text-fuchsia-700 dark:text-fuchsia-300",
  reserved: "bg-amber-500/20 border-amber-500/60 text-amber-700 dark:text-amber-300",
  closed: "bg-muted border-border text-muted-foreground",
};

const STATUSES: TableStatus[] = ["open", "occupied", "reserved", "closed"];

const CANVAS_PRESETS = [
  { label: "Wide (16:9)", width: 16, height: 9 },
  { label: "Classic (4:3)", width: 4, height: 3 },
  { label: "Square (1:1)", width: 1, height: 1 },
  { label: "Long hall (21:9)", width: 21, height: 9 },
];

export default function ManagerFloorMapPage() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [tables, setTables] = useState<VenueTable[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[] | null>(null); // null = panel closed
  const [tableSessions, setTableSessions] = useState<GuestSession[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const [tableList, zoneList, venueData] = await Promise.all([
      venueService.listTables(),
      venueService.listZones(),
      venueService.getVenue(),
    ]);
    setTables(tableList);
    setZones(zoneList);
    setVenue(venueData);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = (tables ?? []).find((t) => t.id === selectedId) ?? null;
  const zoneOf = (zoneId: string) => zones.find((z) => z.id === zoneId);

  // ---------- Canvas size ----------

  async function setCanvasSize(width: number, height: number) {
    if (!venue) return;
    const floorMap = {
      width: Math.min(40, Math.max(1, width)),
      height: Math.min(40, Math.max(1, height)),
    };
    setVenue({ ...venue, floorMap });
    await venueService.updateVenue({ floorMap });
  }

  // ---------- Drag handling (edit mode) ----------

  function onPointerDown(e: React.PointerEvent, table: VenueTable) {
    if (!editMode) {
      const next = table.id === selectedId ? null : table.id;
      setSelectedId(next);
      setTableOrders(null); // close the orders panel when switching tables
      return;
    }
    dragRef.current = { id: table.id, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    drag.moved = true;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(98, Math.max(2, ((e.clientY - rect.top) / rect.height) * 100));
    setTables((prev) =>
      prev ? prev.map((t) => (t.id === drag.id ? { ...t, mapX: x, mapY: y } : t)) : prev,
    );
  }

  async function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return;
    const table = (tables ?? []).find((t) => t.id === drag.id);
    if (table?.mapX !== undefined && table.mapY !== undefined) {
      await venueService.setTablePosition(table.id, table.mapX, table.mapY);
    }
  }

  async function setStatus(table: VenueTable, status: TableStatus) {
    await venueService.setTableStatus(table.id, status);
    toast.success(`${table.code} → ${status}`);
    await refresh();
  }

  // ---------- Inline orders panel ----------

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

  const aspect = venue ? `${venue.floorMap.width} / ${venue.floorMap.height}` : "16 / 9";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Floor map"
        description={
          editMode
            ? "Layout mode — drag tables to match your floor."
            : "Live view — tap a table for details."
        }
        actions={
          <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>
            {editMode ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            {editMode ? "Done editing" : "Edit layout"}
          </Button>
        }
      />

      {/* ---------- Canvas size controls (edit mode) ---------- */}
      {editMode && venue && (
        <Card className="py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Canvas shape</Label>
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
                  Width
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
                  Height
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

      {tables === null ? (
        <Skeleton className="aspect-video w-full rounded-xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
          {/* ---------- Canvas ---------- */}
          <div
            ref={canvasRef}
            style={{ aspectRatio: aspect }}
            className={cn(
              "relative w-full touch-none overflow-hidden rounded-xl border bg-accent/30",
              "bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:24px_24px]",
              editMode && "border-primary/50 border-dashed",
            )}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {tables.map((table) => {
              const zone = zoneOf(table.zoneId);
              return (
                <button
                  key={table.id}
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, table)}
                  style={{ left: `${table.mapX}%`, top: `${table.mapY}%` }}
                  className={cn(
                    "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-[10px] font-semibold shadow-sm transition-shadow",
                    STATUS_NODE[table.status],
                    editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    selectedId === table.id && !editMode && "ring-2 ring-primary shadow-lg",
                  )}
                  aria-label={`${table.code} — ${table.status}`}
                >
                  <span className="font-mono">{table.code}</span>
                  <span className="flex items-center gap-1 font-normal opacity-80">
                    <span
                      className={cn(
                        "inline-block size-1.5 rounded-full",
                        zone ? ZONE_SWATCH[zone.color] ?? "bg-muted-foreground" : "bg-muted-foreground",
                      )}
                    />
                    {table.seats}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ---------- Side panel ---------- */}
          <div className="space-y-3">
            {/* Legend */}
            <Card className="py-3">
              <CardContent className="space-y-2 px-4">
                <p className="text-xs font-medium text-muted-foreground">Zones</p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((zone) => (
                    <span key={zone.id} className="flex items-center gap-1.5 text-xs">
                      <span className={cn("size-2 rounded-full", ZONE_SWATCH[zone.color] ?? "bg-muted-foreground")} />
                      {zone.name}
                    </span>
                  ))}
                </div>
                <p className="pt-1 text-xs font-medium text-muted-foreground">Status</p>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Close details"
                        onClick={() => {
                          setSelectedId(null);
                          setTableOrders(null);
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Users className="size-3.5" /> {selected.seats} seats
                    </p>
                    {selected.minimumSpend !== null && (
                      <p>Minimum spend {formatMoney(selected.minimumSpend)}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {zoneOf(selected.zoneId) && (
                      <EntityChip type="zone" id={selected.zoneId} label={zoneOf(selected.zoneId)!.name} />
                    )}
                    <EntityChip type="zone-staff" id={selected.zoneId} label="Zone staff" />
                  </div>

                  <div className="space-y-1.5 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Set status</p>
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
                          title={`Set ${selected.code} to ${status}?`}
                          description="Table status drives the guest QR flow and runner routing."
                          confirmLabel={`Set ${status}`}
                          onConfirm={() => setStatus(selected, status)}
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
                      {ordersLoading ? "Loading…" : tableOrders !== null ? "Hide orders" : "Orders"}
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
                  {editMode
                    ? "Drag tables into place, then hit “Done editing”."
                    : "Select a table on the map to see its details."}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ---------- Inline orders for the selected table ---------- */}
      {selected && tableOrders !== null && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Orders — <span className="font-mono">{selected.code}</span>
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {tableOrders.length} order{tableOrders.length === 1 ? "" : "s"} ·{" "}
                {formatMoney(tableOrders.reduce((s, o) => s + o.total, 0))} total
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setTableOrders(null)}>
              <X className="size-3.5" /> Close
            </Button>
          </div>
            {tableSessions.length > 0 ? (
              <SessionOverview sessions={tableSessions} orders={tableOrders} />
            ) : tableOrders.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No orders from this table tonight"
                description="Orders appear here the moment a guest submits one."
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
