"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowRight, LifeBuoy, MapPin, Moon, Receipt, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { mockOrdersService } from "@/lib/mock-services/orders-service";
import { mockGuestsService } from "@/lib/mock-services/guests-service";
import { mockMenuService } from "@/lib/mock-services/menu-service";
import { mockStaffService } from "@/lib/mock-services/staff-service";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { timeAgo } from "@/lib/format";
import type { SoldOutEvent, StaffMember, Zone } from "@/lib/types";

interface QueueCounts {
  pendingOrders: number;
  activeOrders: number;
  pendingApprovals: number;
  openHelp: number;
}

export default function StaffHomePage() {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [soldOut, setSoldOut] = useState<SoldOutEvent[]>([]);

  useEffect(() => {
    Promise.all([
      mockOrdersService.listOrders(),
      mockGuestsService.listSessions("pending"),
      mockGuestsService.listHelpRequests(),
      mockStaffService.getCurrentStaff(),
      mockVenueService.listZones(),
    ]).then(([orders, pendingSessions, help, currentStaff, zoneList]) => {
      setCounts({
        pendingOrders: orders.filter((o) => o.status === "pending").length,
        activeOrders: orders.filter((o) =>
          ["accepted", "preparing", "ready"].includes(o.status),
        ).length,
        pendingApprovals: pendingSessions.length,
        openHelp: help.filter((h) => h.status !== "resolved").length,
      });
      setMe(currentStaff);
      setZones(zoneList);
    });
  }, []);

  useEffect(() => {
    const refresh = () => mockMenuService.listSoldOutEvents().then(setSoldOut);
    refresh();
    // TODO(backend): WebSocket push instead of polling.
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, []);

  const myZones = me
    ? zones.filter((z) => me.assignedZoneIds.includes(z.id)).map((z) => z.name)
    : [];

  const tiles = counts
    ? [
        { href: "/staff/orders", label: "New orders", value: counts.pendingOrders, icon: Receipt, urgent: counts.pendingOrders > 0 },
        { href: "/staff/orders", label: "In progress", value: counts.activeOrders, icon: Receipt, urgent: false },
        { href: "/staff/approvals", label: "Approvals", value: counts.pendingApprovals, icon: UserCheck, urgent: counts.pendingApprovals > 0 },
        { href: "/staff/help", label: "Help requests", value: counts.openHelp, icon: LifeBuoy, urgent: counts.openHelp > 0 },
      ]
    : [];

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          Good evening{me ? `, ${me.name.split(" ")[0]}` : ""}
          <Moon className="size-4 text-primary" />
        </h1>
        {myZones.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> Your zones: {myZones.join(", ")}
          </p>
        )}
      </div>

      {counts === null ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile, i) => (
            <Link key={`${tile.label}-${i}`} href={tile.href}>
              <Card
                className={`h-full py-4 transition-colors hover:border-primary/50 ${
                  tile.urgent ? "border-amber-500/40" : ""
                }`}
              >
                <CardContent className="px-4">
                  <div className="flex items-center justify-between">
                    <tile.icon className="size-4 text-primary" />
                    {tile.urgent && (
                      <span className="size-2 animate-pulse rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{tile.value}</p>
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="py-4">
        <CardContent className="flex items-center justify-between px-4">
          <div>
            <p className="text-sm font-medium">Runner mode</p>
            <p className="text-xs text-muted-foreground">
              See only orders in your assigned zones
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/staff/orders?scope=mine">
              Open <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {soldOut.length > 0 && (
        <Card className="border-red-500/30 py-4">
          <CardContent className="space-y-2 px-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <AlertOctagon className="size-4 text-red-600 dark:text-red-400" /> 86&apos;d tonight
            </p>
            <ul className="space-y-1">
              {soldOut.slice(0, 5).map((event) => (
                <li key={event.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{event.itemName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(event.at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
