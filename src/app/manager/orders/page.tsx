"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox, ListFilter, RefreshCw, Search, X, Wallet } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { AdjustmentDialog } from "@/components/shared/adjustment-dialog";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { menuService } from "@/features/menu/services";
import { ordersService } from "@/features/ordering/services";
import { staffService } from "@/features/workforce/staff-service";
import { guestsService } from "@/features/guests/services";
import { venueService } from "@/features/venue/services";
import { usePermissions } from "@/features/platform/use-permissions";
import { formatMoney } from "@/features/shared/format";
import { useLiveEvents } from "@/lib/use-live-events";
import { SessionOverview } from "@/components/shared/session-overview";
import { useAuth } from "@/context/auth-context";
import { ordersKeys } from "@/features/ordering/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { menuKeys } from "@/features/menu/query-keys";
import { sessionsKeys } from "@/features/guests/query-keys";
import { cn } from "@/features/shared/utils";
import { DateFilter, isInDateRange, type DateRange } from "@/components/shared/date-filter";
import { DateRangePicker, getDefaultDateRange, isInCustomDateRange, type DateRangeValue } from "@/components/shared/date-range-picker";
import type {
  GuestSession, MenuCategory, MenuItem, Order, OrderStatus, StaffMember, TabAdjustmentKind, VenueTable, Zone,
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
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const [view, setView] = useState<"orders" | "sessions">("orders");

  // Filters
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | OrderStatus>("active");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [sessionDateRange, setSessionDateRange] = useState<DateRangeValue>(getDefaultDateRange);

  const { data: orders } = useQuery({
    queryKey: ordersKeys.all(venueId),
    queryFn: () => ordersService.listOrders(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const { data: items = [] } = useQuery({
    queryKey: menuKeys.items(venueId),
    queryFn: () => menuService.listItems(),
    enabled: !!venueId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: menuKeys.categories(venueId),
    queryFn: () => menuService.listCategories(true),
    enabled: !!venueId,
  });

  const { data: sessions } = useQuery({
    queryKey: sessionsKeys.all(venueId),
    queryFn: () => guestsService.listSessions(),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { can } = usePermissions();

  const { data: venueSnapshot } = useQuery({
    queryKey: venueKeys.snapshot(venueId),
    queryFn: () => venueService.getVenueSnapshot(),
    enabled: !!venueId,
  });

  const compThresholdCents = venueSnapshot?.compThresholdCents ?? 0;
  const minimumSpendWarningRatio = venueSnapshot?.minimumSpendWarningRatio ?? 0.25;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ordersKeys.all(venueId) });
  };

  const refreshAfterTabAction = () => {
    queryClient.invalidateQueries({ queryKey: ordersKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: sessionsKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: venueKeys.tables(venueId) });
  };

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useLiveEvents({
    scope: "manager",
    onEvent: () => refreshRef.current(),
    fallbackMs: 10000,
    fallbackRefresh: () => refreshRef.current(),
  });

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

        if (!isInDateRange(order.placedAt, dateRange)) return false;

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
  }, [orders, status, zoneFilter, tableFilter, staffFilter, categoryFilter, query, staff, itemCategory, dateRange]);

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, status, zoneFilter, tableFilter, staffFilter, categoryFilter, dateRange, reset]);

  const hasFilters =
    query !== "" ||
    status !== "active" ||
    zoneFilter !== "all" ||
    tableFilter !== "all" ||
    staffFilter !== "all" ||
    categoryFilter !== "all" ||
    dateRange !== "today";

  function clearFilters() {
    setQuery("");
    setStatus("active");
    setZoneFilter("all");
    setTableFilter("all");
    setStaffFilter("all");
    setCategoryFilter("all");
    setDateRange("today");
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
          <TooltipIconButton variant="ghost" onClick={refresh} tooltip="Refresh">
            <RefreshCw className="size-4" />
          </TooltipIconButton>
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
          {/* ---------- Filters (top) ---------- */}
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

              <div className="flex flex-wrap items-center gap-3">
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
                <div className="h-4 w-px bg-border" />
                <DateFilter value={dateRange} onChange={setDateRange} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select
                  value={zoneFilter}
                  onValueChange={(v) => {
                    setZoneFilter(v);
                    setTableFilter("all");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All zones</SelectItem>
                    {zones.map((zone: Zone) => (
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
                    {zoneTables.map((table: VenueTable) => (
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
                      .filter((s: StaffMember) => s.assignedZoneIds.length > 0)
                      .map((member: StaffMember) => (
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
                    {categories.map((cat: MenuCategory) => (
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

          {orders === undefined ? (
            <ListSkeleton rows={4} rowHeight="h-36" />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No orders match"
              description={hasFilters ? "Try adjusting the filters above." : "The night is young."}
            />
          ) : (
            <>
            <div className="grid gap-3 md:grid-cols-2">
              {sliced.map((order: Order) => {
                const availableKinds: TabAdjustmentKind[] = me
                  ? (["void", "comp", "discount"] as const).filter((k) => can(`tab:${k}` as const))
                  : [];
                const canAdjust = !!order.sessionId && order.status !== "pending" && order.status !== "cancelled" && availableKinds.length > 0;
                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    footer={
                      canAdjust && me ? (
                        <AdjustmentDialog
                          order={order}
                          availableKinds={availableKinds}
                          authorStaffId={me.id}
                          authorStaffName={me.name}
                          compThresholdCents={compThresholdCents}
                          isManager={me.role === "manager"}
                          onDone={refresh}
                          trigger={
                            <Button variant="outline" size="sm" className="w-full">
                              <Wallet className="size-3.5" /> Adjust tab
                            </Button>
                          }
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
            <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
            </>
          )}
        </>
      ) : (
        <>
          <DateRangePicker value={sessionDateRange} onChange={setSessionDateRange} />
          {sessions === undefined ? (
            <ListSkeleton rows={4} rowHeight="h-32" />
          ) : (
            <SessionOverview
              sessions={sessions.filter((s: GuestSession) => isInCustomDateRange(s.createdAt, sessionDateRange))}
              orders={orders ?? []}
              tables={tables}
              menuItems={items ?? []}
              minimumSpendWarningRatio={minimumSpendWarningRatio}
              staffContext={me ? {
                staffId: me.id,
                staffName: me.name,
                canTransfer: can("tab:transfer"),
                canMerge: can("tab:merge"),
                canRefuseService: can("service:refuse"),
                canEjectGuest: can("service:refuse"),
                onChange: refreshAfterTabAction,
              } : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
