"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, ListFilter, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { mockMenuService } from "@/lib/mock-services/menu-service";
import { mockOrdersService } from "@/lib/mock-services/orders-service";
import { mockStaffService } from "@/lib/mock-services/staff-service";
import { mockGuestsService } from "@/lib/mock-services/guests-service";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { formatMoney } from "@/lib/format";
import { SessionOverview } from "@/components/shared/session-overview";
import { cn } from "@/lib/utils";
import type {
  GuestSession, MenuCategory, MenuItem, Order, OrderStatus, StaffMember, VenueTable, Zone,
} from "@/lib/types";

const STATUS_FILTERS: { id: "all" | "active" | OrderStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function ManagerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [view, setView] = useState<"orders" | "sessions">("orders");
  const [sessions, setSessions] = useState<GuestSession[] | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | OrderStatus>("active");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const refresh = useCallback(async () => {
    setOrders(await mockOrdersService.listOrders());
  }, []);

  useEffect(() => {
    refresh();
    mockVenueService.listZones().then(setZones);
    mockVenueService.listTables().then(setTables);
    mockStaffService.listStaff().then(setStaff);
    mockMenuService.listItems().then(setItems);
    mockMenuService.listCategories(true).then(setCategories);
    mockGuestsService.listSessions().then(setSessions);
    // TODO(backend): WebSocket push instead of polling.
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const itemCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.id, item.categoryId);
    return map;
  }, [items]);

  const visible = useMemo(() => {
    return (orders ?? [])
      .filter((order) => {
        if (status === "active") {
          if (["delivered", "cancelled"].includes(order.status)) return false;
        } else if (status !== "all" && order.status !== status) return false;

        if (zoneFilter !== "all" && order.zoneId !== zoneFilter) return false;
        if (tableFilter !== "all" && order.tableId !== tableFilter) return false;

        if (staffFilter !== "all") {
          const member = staff.find((s) => s.id === staffFilter);
          if (!member || !member.assignedZoneIds.includes(order.zoneId)) return false;
        }

        if (categoryFilter !== "all") {
          const hasCategory = order.items.some(
            (line) => itemCategory.get(line.menuItemId) === categoryFilter,
          );
          if (!hasCategory) return false;
        }

        if (query.trim()) {
          const q = query.trim().toLowerCase();
          const haystack = [
            order.code,
            order.tableCode,
            order.zoneName,
            order.guestName,
            ...order.items.map((l) => l.name),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  }, [orders, status, zoneFilter, tableFilter, staffFilter, categoryFilter, query, staff, itemCategory]);

  const hasFilters =
    query !== "" ||
    status !== "active" ||
    zoneFilter !== "all" ||
    tableFilter !== "all" ||
    staffFilter !== "all" ||
    categoryFilter !== "all";

  function clearFilters() {
    setQuery("");
    setStatus("active");
    setZoneFilter("all");
    setTableFilter("all");
    setStaffFilter("all");
    setCategoryFilter("all");
  }

  const visibleTotal = visible.reduce((s, o) => s + o.total, 0);
  const zoneTables = tables.filter((t) => zoneFilter === "all" || t.zoneId === zoneFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={
          orders
            ? `${visible.length} of ${orders.length} orders · ${formatMoney(visibleTotal)}`
            : "Loading the feed…"
        }
        actions={
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        }
      />

      {/* ---------- View toggle ---------- */}
      <div className="flex gap-1.5">
        {(["orders", "sessions"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium capitalize transition-colors",
              view === v ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "orders" ? "Order feed" : "Sessions"}
          </button>
        ))}
      </div>

      {/* ---------- Queue ---------- */}
      {view === "orders" ? (
        <>
          {orders === null ? (
        <ListSkeleton rows={4} rowHeight="h-36" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No orders match"
          description={hasFilters ? "Try loosening the filters below." : "The night is young."}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* ---------- Filters ---------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ListFilter className="size-4 text-primary" /> Filters
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" /> Clear all
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order code, table, guest or item…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatus(f.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  status === f.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={zoneFilter}
              onValueChange={(v) => {
                setZoneFilter(v);
                setTableFilter("all"); // table list narrows with the zone
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Zone" />
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

            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {zoneTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.code} · {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff
                  .filter((s) => s.assignedZoneIds.length > 0)
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} · {member.role}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Staff filter shows orders in that team member&apos;s assigned zones.{" "}
            {hasFilters && (
              <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
                {visible.length} matches
              </Badge>
            )}
          </p>
        </CardContent>
      </Card>
        </>
      ) : (
        sessions === null ? (
          <ListSkeleton rows={4} rowHeight="h-32" />
        ) : (
          <SessionOverview sessions={sessions} orders={orders ?? []} />
        )
      )}
    </div>
  );
}
