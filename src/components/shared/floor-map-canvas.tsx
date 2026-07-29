"use client";

import { useRef, useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/features/shared/utils";
import { ZONE_SWATCH } from "@/features/shared/zone-colors";
import type { TableStatus, VenueTable, Zone } from "@/lib/types";

const STATUS_NODE: Record<TableStatus, string> = {
  open: "bg-emerald-500/20 border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
  occupied: "bg-fuchsia-500/25 border-fuchsia-500/70 text-fuchsia-700 dark:text-fuchsia-300",
  reserved: "bg-amber-500/20 border-amber-500/60 text-amber-700 dark:text-amber-300",
  closed: "bg-muted border-border text-muted-foreground",
  held: "bg-gray-500/20 border-gray-500/60 text-gray-700 dark:text-gray-300",
  "out-of-service": "bg-gray-500/20 border-gray-500/60 text-gray-700 dark:text-gray-300",
};

export interface FloorMapCanvasProps {
  tables: VenueTable[];
  zones: Zone[];
  aspectRatio: string;
  selectedId?: string | null;
  readonly?: boolean;
  onSelectTable?: (table: VenueTable) => void;
  editMode?: boolean;
  /** Called when a table finishes dragging in edit mode with its new position. */
  onTableDrag?: (tableId: string, mapX: number, mapY: number) => void;
  nodeClassName?: (table: VenueTable) => string | undefined;
  nodeContent?: (table: VenueTable) => React.ReactNode;
}

function DraggableTable({
  table,
  zoneColor,
  selectedId,
  editMode,
  extra,
  nodeContent,
  onSelectTable,
}: {
  table: VenueTable;
  zoneColor?: string;
  selectedId?: string | null;
  editMode?: boolean;
  extra?: string;
  nodeContent?: (table: VenueTable) => React.ReactNode;
  onSelectTable?: (table: VenueTable) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id,
    disabled: !editMode,
    data: { table },
  });

  const style = transform
    ? {
        left: `${table.mapX}%`,
        top: `${table.mapY}%`,
        transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : {
        left: `${table.mapX}%`,
        top: `${table.mapY}%`,
        transform: "translate(-50%, -50%)",
      };

  return (
    <button
      key={table.id}
      type="button"
      ref={editMode ? setNodeRef : undefined}
      {...(editMode ? { ...listeners, ...attributes } : {})}
      onClick={() => !editMode && onSelectTable?.(table)}
      style={style}
      className={cn(
        "absolute flex flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-[10px] font-semibold shadow-sm transition-shadow",
        STATUS_NODE[table.status],
        editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selectedId === table.id && !editMode && "ring-2 ring-primary shadow-lg",
        extra,
      )}
      aria-label={`${table.code} — ${table.status}`}
    >
      <span className="font-mono">{table.code}</span>
      <span className="flex items-center gap-1 font-normal opacity-80">
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            zoneColor ?? "bg-muted-foreground",
          )}
        />
        {table.seats}
      </span>
      {nodeContent?.(table)}
    </button>
  );
}

export function FloorMapCanvas({
  tables,
  zones,
  aspectRatio,
  selectedId,
  readonly,
  onSelectTable,
  editMode,
  onTableDrag,
  nodeClassName,
  nodeContent,
}: FloorMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoneOf = (zoneId: string) => zones.find((z) => z.id === zoneId);

  const [draggingTable, setDraggingTable] = useState<VenueTable | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const table = tables.find((t) => t.id === event.active.id);
      if (table) setDraggingTable(table);
    },
    [tables],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!onTableDrag) { setDraggingTable(null); return; }
      const table = tables.find((t) => t.id === event.active.id);
      if (!table || !canvasRef.current) { setDraggingTable(null); return; }

      const rect = canvasRef.current.getBoundingClientRect();
      const dxPct = event.delta.x / rect.width * 100;
      const dyPct = event.delta.y / rect.height * 100;
      const x = Math.min(98, Math.max(2, (table.mapX ?? 50) + dxPct));
      const y = Math.min(98, Math.max(2, (table.mapY ?? 50) + dyPct));

      onTableDrag(table.id, x, y);
      setDraggingTable(null);
    },
    [tables, onTableDrag],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={canvasRef}
        style={{ aspectRatio }}
        className={cn(
          "relative w-full touch-none overflow-hidden rounded-xl border bg-accent/30",
          "bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:24px_24px]",
          "max-lg:!aspect-[3/4] max-lg:min-h-[400px]",
          editMode && "border-primary/50 border-dashed",
        )}
      >
        {tables.map((table) => (
          <DraggableTable
            key={table.id}
            table={table}
            zoneColor={zoneOf(table.zoneId) ? ZONE_SWATCH[zoneOf(table.zoneId)!.color] : undefined}
            selectedId={selectedId}
            editMode={editMode}
            extra={nodeClassName?.(table)}
            nodeContent={nodeContent}
            onSelectTable={onSelectTable}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingTable && (
          <div
            className={cn(
              "rounded-lg border-2 px-3 py-2 text-[11px] font-semibold shadow-xl opacity-90",
              STATUS_NODE[draggingTable.status],
            )}
          >
            <span className="font-mono">{draggingTable.code}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
