"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ZONE_SWATCH } from "@/lib/zone-colors";
import type { TableStatus, VenueTable, Zone } from "@/lib/types";

const STATUS_NODE: Record<TableStatus, string> = {
  open: "bg-emerald-500/20 border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
  occupied: "bg-fuchsia-500/25 border-fuchsia-500/70 text-fuchsia-700 dark:text-fuchsia-300",
  reserved: "bg-amber-500/20 border-amber-500/60 text-amber-700 dark:text-amber-300",
  closed: "bg-muted border-border text-muted-foreground",
};

export interface FloorMapCanvasProps {
  tables: VenueTable[];
  zones: Zone[];
  aspectRatio: string;
  selectedId?: string | null;
  readonly?: boolean;
  onSelectTable?: (table: VenueTable) => void;
  /** Edit-mode drag handlers (manager only) */
  editMode?: boolean;
  onDragStart?: (e: React.PointerEvent, table: VenueTable) => void;
  onDragMove?: (e: React.PointerEvent) => void;
  onDragEnd?: (e: React.PointerEvent) => void;
  /** Override node styling per table (e.g. dimming unavailable tables) */
  nodeClassName?: (table: VenueTable) => string | undefined;
  /** Extra content rendered inside each table node */
  nodeContent?: (table: VenueTable) => React.ReactNode;
}

export function FloorMapCanvas({
  tables,
  zones,
  aspectRatio,
  selectedId,
  readonly,
  onSelectTable,
  editMode,
  onDragStart,
  onDragMove,
  onDragEnd,
  nodeClassName,
  nodeContent,
}: FloorMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoneOf = (zoneId: string) => zones.find((z) => z.id === zoneId);

  function handlePointerDown(e: React.PointerEvent, table: VenueTable) {
    if (editMode && onDragStart) {
      onDragStart(e, table);
      return;
    }
    if (onSelectTable) {
      onSelectTable(table);
    }
  }

  return (
    <div
      ref={canvasRef}
      style={{ aspectRatio }}
      className={cn(
        "relative w-full touch-none overflow-hidden rounded-xl border bg-accent/30",
        "bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:24px_24px]",
        "max-lg:!aspect-[3/4] max-lg:min-h-[400px]",
        editMode && "border-primary/50 border-dashed",
      )}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
    >
      {tables.map((table) => {
        const zone = zoneOf(table.zoneId);
        const extra = nodeClassName?.(table);
        return (
          <button
            key={table.id}
            type="button"
            onPointerDown={(e) => handlePointerDown(e, table)}
            style={{ left: `${table.mapX}%`, top: `${table.mapY}%` }}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-[10px] font-semibold shadow-sm transition-shadow",
              STATUS_NODE[table.status],
              editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
              selectedId === table.id && !editMode && "ring-2 ring-primary shadow-lg",
              readonly && "cursor-default",
              extra,
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
            {nodeContent?.(table)}
          </button>
        );
      })}
    </div>
  );
}
