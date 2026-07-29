"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EntityChip } from "@/components/shared/entity-chip";
import { MANAGER_NAV_GROUPS, type NavItem } from "@/features/shared/navigation";
import { getStaffNav } from "@/features/shared/role-capabilities";
import { ordersService } from "@/features/ordering/services";
import { venueService } from "@/features/venue/services";
import { staffService } from "@/features/workforce/staff-service";
import { menuService } from "@/features/menu/services";
import { reservationService } from "@/features/hospitality/reservation-service";
import { guestService } from "@/features/sessions/services";
import { cn } from "@/features/shared/utils";
import {
  MANAGER_ACTION_COMMANDS,
  STAFF_ACTION_COMMANDS,
  type ActionCommand,
} from "@/features/shared/action-commands";
import type { EntityChipType } from "@/components/shared/entity-chip";
import type { StaffRole } from "@/lib/types";

interface EntityResult {
  id: string;
  type: EntityChipType;
  label: string;
  href: string;
}

type PaletteResult = EntityResult | NavItem | (ActionCommand & { _type: "action" });

export function CommandPalette({
  open,
  onClose,
  scope = "manager",
  role,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  scope?: "manager" | "staff";
  role?: StaffRole;
  onAction?: (action: ActionCommand) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<EntityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIdxRef = useRef(0);

  const navItems: NavItem[] = useMemo(
    () =>
      scope === "manager"
        ? MANAGER_NAV_GROUPS.flatMap((g) => g.items)
        : role
          ? getStaffNav(role)
          : [],
    [scope, role],
  );

  const actionCommands: ActionCommand[] = useMemo(
    () => (scope === "manager" ? MANAGER_ACTION_COMMANDS : STAFF_ACTION_COMMANDS),
    [scope],
  );

  const filteredNav = useMemo(
    () =>
      query
        ? navItems.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
        : navItems,
    [query, navItems],
  );

  const filteredActions = useMemo(
    () =>
      query
        ? actionCommands.filter(
            (a) =>
              a.label.toLowerCase().includes(query.toLowerCase()) ||
              a.description?.toLowerCase().includes(query.toLowerCase()),
          )
        : actionCommands,
    [query, actionCommands],
  );

  const allResults: PaletteResult[] = useMemo(() => {
    if (!query) {
      return [
        ...filteredActions.map((a) => ({ ...a, _type: "action" as const })),
        ...filteredNav,
      ] as PaletteResult[];
    }
    return [
      ...entities.slice(0, 3),
      ...filteredActions.map((a) => ({ ...a, _type: "action" as const })),
      ...filteredNav.slice(0, 5),
    ] as PaletteResult[];
  }, [entities, filteredNav, filteredActions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEntities([]);
    selectedIdxRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setEntities([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [orders, tables, staff, items, reservations, profiles] = await Promise.all([
          ordersService.listOrders(),
          venueService.listTables(),
          staffService.listStaff(),
          menuService.listItems(),
          reservationService.listReservations(),
          guestService.searchProfiles(query),
        ]);
        const results: EntityResult[] = [];
        const lower = query.toLowerCase();
        for (const o of orders) {
          if (o.code.toLowerCase().includes(lower))
            results.push({ id: o.id, type: "table", label: `Order ${o.code}`, href: `/manager/orders?highlight=${o.id}` });
        }
        for (const t of tables) {
          if (t.code.toLowerCase().includes(lower))
            results.push({ id: t.id, type: "table", label: `Table ${t.code}`, href: `/manager/tables?highlight=${t.id}` });
        }
        for (const s of staff) {
          if (s.name.toLowerCase().includes(lower))
            results.push({ id: s.id, type: "table", label: s.name, href: `/manager/staff?highlight=${s.id}` });
        }
        for (const i of items) {
          if (i.name.toLowerCase().includes(lower))
            results.push({ id: i.id, type: "table", label: i.name, href: `/manager/menu?highlight=${i.id}` });
        }
        for (const r of reservations) {
          if (r.guestName.toLowerCase().includes(lower))
            results.push({ id: r.id, type: "reservation", label: r.guestName, href: `/manager/reservations?highlight=${r.id}` });
        }
        for (const p of profiles ?? []) {
          if (p.displayName.toLowerCase().includes(lower))
            results.push({ id: p.id, type: "guest-profile", label: p.displayName, href: `/manager/guests?highlight=${p.id}` });
        }
        setEntities(results.slice(0, 5));
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIdxRef.current = Math.min(selectedIdxRef.current + 1, allResults.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIdxRef.current = Math.max(selectedIdxRef.current - 1, -1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeResult(allResults[selectedIdxRef.current]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, allResults, router, onClose]);

  function executeResult(result: PaletteResult) {
    if (!result) return;
    if ("_type" in result && result._type === "action") {
      const action = result as ActionCommand;
      if (action.type === "navigate" && action.href) {
        router.push(action.href);
        onClose();
      } else if (onAction) {
        onClose();
        onAction(action);
      }
      return;
    }
    const href = "type" in result ? (result as EntityResult).href : (result as NavItem).href;
    router.push(href);
    onClose();
  }

  const executeResultRef = useRef(executeResult);
  executeResultRef.current = executeResult;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIdxRef.current = Math.min(selectedIdxRef.current + 1, allResults.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIdxRef.current = Math.max(selectedIdxRef.current - 1, -1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeResultRef.current(allResults[selectedIdxRef.current]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, allResults]);

  function selectResult(idx: number) {
    selectedIdxRef.current = idx;
    executeResult(allResults[idx]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center border-b px-3">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); selectedIdxRef.current = 0; }}
            placeholder="Search orders, tables, staff… or type commands"
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {searching && <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>}
          {allResults.length === 0 && query.length > 0 && !searching && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          )}
          {allResults.map((result, idx) => {
            const isEntity = "type" in result && !("_type" in result);
            const isAction = "_type" in result && result._type === "action";
            return (
              <button
                key={
                  isAction
                    ? `action-${(result as ActionCommand).key}`
                    : isEntity
                      ? (result as EntityResult).href
                      : (result as NavItem).href
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  idx === selectedIdxRef.current ? "bg-accent" : "hover:bg-accent",
                )}
                onMouseEnter={() => { selectedIdxRef.current = idx; }}
                onClick={() => selectResult(idx)}
              >
                {isAction ? (
                  <>
                    {(result as ActionCommand).icon && (
                      <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
                        <result.icon className="size-3" />
                      </span>
                    )}
                    <div className="flex flex-col">
                      <span>{result.label}</span>
                      {(result as ActionCommand).description && (
                        <span className="text-[10px] text-muted-foreground">
                          {(result as ActionCommand).description}
                        </span>
                      )}
                    </div>
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">
                      {(result as ActionCommand).type === "navigate" ? "Go" : "Run"}
                    </span>
                  </>
                ) : isEntity ? (
                  <EntityChip type={result.type} id={result.id} label={result.label} />
                ) : (
                  <>
                    <result.icon className="size-4 text-muted-foreground" />
                    {result.label}
                  </>
                )}
              </button>
            );
          })}
        </div>
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground flex gap-3">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
