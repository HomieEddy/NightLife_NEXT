"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon, AlertTriangle, ArrowRight, CalendarCheck, CalendarDays, Clock,
  DollarSign, DoorOpen, LifeBuoy, MapPin, MessageSquare, Moon,
  PartyPopper, Receipt, Shield, UserCheck, Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClockCard } from "@/components/shared/clock-card";
import { CountUp } from "@/components/fx/count-up";
import { doorService } from "@/features/door/services";
import { incidentService } from "@/features/safety/services";
import { ordersService } from "@/features/ordering/services";
import { guestsService } from "@/features/guests/services";
import { menuService } from "@/features/menu/services";
import { reservationService } from "@/features/hospitality/reservation-service";
import { showQueueService } from "@/features/realtime/show-queue-service";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { formatMoney, timeAgo } from "@/features/shared/format";
import { useLiveEvents } from "@/lib/use-live-events";
import type { ActiveShow, ChatMessage, Order, Reservation, SoldOutEvent, StaffMember, StaffShift, Zone } from "@/lib/types";

interface QueueCounts {
  pendingOrders: number;
  activeOrders: number;
  pendingApprovals: number;
  openHelp: number;
}

interface PromoterStats {
  requested: number;
  confirmed: number;
  seated: number;
  guestsInHouse: number;
  attributedRevenue: number;
}

function computePromoterStats(reservations: Reservation[], sessions: { id: string; promoterId?: string; partySize: number; status: string }[], orders: Order[], promoterId: string): PromoterStats {
  const requested = reservations.filter((r) => r.status === "requested").length;
  const confirmed = reservations.filter((r) => r.status === "confirmed").length;
  const seated = reservations.filter((r) => r.status === "seated").length;
  const mySessions = sessions.filter((s) => s.promoterId === promoterId && s.status === "approved");
  const guestsInHouse = mySessions.reduce((sum, s) => sum + s.partySize, 0);
  const sessionIds = new Set(mySessions.map((s) => s.id));
  const attributedRevenue = orders
    .filter((o) => o.sessionId && sessionIds.has(o.sessionId) && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);
  return { requested, confirmed, seated, guestsInHouse, attributedRevenue: Math.round(attributedRevenue * 100) / 100 };
}

// ---------- Security home ----------

interface SecurityHomeProps {
  me: StaffMember;
  openSecurityCount: number;
  todayShifts: StaffShift[];
  securityBroadcasts: ChatMessage[];
  occupancy: { current: number; legalCapacity: number } | null;
  openIncidentCount: number;
}

function SecurityHome({ me, openSecurityCount, todayShifts, securityBroadcasts, occupancy, openIncidentCount }: SecurityHomeProps) {
  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          Good evening, {me.name.split(" ")[0]}
          <Shield className="size-4 text-primary" />
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Security · door + trouble + hours + radio</p>
      </div>

      {/* Door + incidents — the actual job */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/staff/door">
          <Card className="h-full py-4 transition-colors hover:border-primary/50">
            <CardContent className="px-4">
              <DoorOpen className="size-4 text-primary" />
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {occupancy ? occupancy.current : "…"}
              </p>
              <p className="text-xs text-muted-foreground">
                Occupancy{occupancy ? ` / ${occupancy.legalCapacity}` : ""}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/staff/incidents">
          <Card className={`h-full py-4 transition-colors hover:border-primary/50 ${openIncidentCount > 0 ? "border-amber-500/40" : ""}`}>
            <CardContent className="px-4">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-primary" />
                {openIncidentCount > 0 && <span className="size-2 animate-pulse rounded-full bg-amber-400" />}
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{openIncidentCount}</p>
              <p className="text-xs text-muted-foreground">Open incidents</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Open security requests */}
      <Link href="/staff/help">
        <Card className={`py-4 transition-colors hover:border-primary/50 ${openSecurityCount > 0 ? "border-red-500/40" : ""}`}>
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Shield className="size-4 text-primary" />
                {openSecurityCount > 0 && (
                  <span className="size-2 animate-pulse rounded-full bg-red-400" />
                )}
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{openSecurityCount}</p>
              <p className="text-xs text-muted-foreground">Open security requests</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Tonight's shift */}
      <Card className="py-4">
        <CardContent className="space-y-2 px-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" /> Tonight&apos;s shift
          </p>
          {todayShifts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No shift scheduled for today.</p>
          ) : (
            todayShifts.map((shift) => (
              <div key={shift.id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                {shift.startTime} – {shift.endTime}
              </div>
            ))
          )}
          <Button size="sm" variant="outline" asChild className="mt-1">
            <Link href="/staff/schedule">Full schedule <ArrowRight className="size-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>

      {/* Latest security broadcasts */}
      {securityBroadcasts.length > 0 && (
        <Card className="py-4">
          <CardContent className="space-y-2 px-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MessageSquare className="size-4 text-primary" /> Security channel
            </p>
            <ul className="space-y-2">
              {securityBroadcasts.map((msg) => (
                <li key={msg.id} className="text-sm">
                  <span className="font-medium">{msg.authorName}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(msg.sentAt)}</span>
                  <p className="mt-0.5 text-muted-foreground">{msg.body}</p>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" asChild className="mt-1">
              <Link href="/staff/chat">Open chat <ArrowRight className="size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Main home ----------

export default function StaffHomePage() {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [promoStats, setPromoStats] = useState<PromoterStats | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [soldOut, setSoldOut] = useState<SoldOutEvent[]>([]);
  const [activeShow, setActiveShow] = useState<ActiveShow | null>(null);
  // Security-specific state
  const [securityRequestCount, setSecurityRequestCount] = useState(0);
  const [todayShifts, setTodayShifts] = useState<StaffShift[]>([]);
  const [securityBroadcasts, setSecurityBroadcasts] = useState<ChatMessage[]>([]);
  const [occupancy, setOccupancy] = useState<{ current: number; legalCapacity: number } | null>(null);
  const [openIncidentCount, setOpenIncidentCount] = useState(0);

  useEffect(() => {
    Promise.all([
      ordersService.listOrders(),
      guestsService.listSessions("pending"),
      guestsService.listHelpRequests(),
      staffService.getCurrentStaff(),
      venueService.listZones(),
    ]).then(async ([orders, pendingSessions, help, currentStaff, zoneList]) => {
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

      if (currentStaff.role === "promoter") {
        const [myRes, allSessions, allOrders] = await Promise.all([
          reservationService.listMyReservations(currentStaff.id),
          guestsService.listSessions(),
          ordersService.listOrders(),
        ]);
        setPromoStats(computePromoterStats(myRes, allSessions, allOrders, currentStaff.id));
      }

      if (currentStaff.role === "security") {
        const today = new Date().getDay();
        const [allShifts, secMsgs, occ, openIncidents] = await Promise.all([
          staffService.listShifts(),
          staffService.listMessages("security"),
          doorService.getOccupancy(),
          incidentService.listIncidents({ status: "open" }),
        ]);
        setSecurityRequestCount(help.filter((h) => h.type === "security" && h.status !== "resolved").length);
        setTodayShifts(allShifts.filter((s) => s.staffId === currentStaff.id && s.dayOfWeek === today));
        setSecurityBroadcasts(secMsgs.slice(-3).reverse());
        setOccupancy({ current: occ.current, legalCapacity: occ.legalCapacity });
        setOpenIncidentCount(openIncidents.length);
      }
    });
  }, []);

  const refreshExtras = useCallback(() => {
    menuService.listSoldOutEvents().then(setSoldOut);
    showQueueService.getActiveShow().then(setActiveShow);
  }, []);

  useEffect(() => { refreshExtras(); }, [refreshExtras]);

  const refreshExtrasRef = useRef(refreshExtras);
  refreshExtrasRef.current = refreshExtras;

  useLiveEvents({
    scope: "staff",
    onEvent: () => refreshExtrasRef.current(),
    fallbackMs: 8000,
    fallbackRefresh: () => refreshExtrasRef.current(),
  });

  const myZones = me
    ? zones.filter((z) => me.assignedZoneIds.includes(z.id)).map((z) => z.name)
    : [];

  const isPromoter = me?.role === "promoter";
  const isSecurity = me?.role === "security";
  const isRunner = me?.role === "runner";

  // Security home delegates to its own component once data is ready.
  if (isSecurity && me && counts !== null) {
    return (
      <SecurityHome
        me={me}
        openSecurityCount={securityRequestCount}
        todayShifts={todayShifts}
        securityBroadcasts={securityBroadcasts}
        occupancy={occupancy}
        openIncidentCount={openIncidentCount}
      />
    );
  }

  const tiles = counts
    ? isPromoter && promoStats
      ? [
          { href: "/staff/reservations", label: "Requested", value: String(promoStats.requested), count: promoStats.requested, icon: CalendarCheck, urgent: false },
          { href: "/staff/reservations", label: "Confirmed", value: String(promoStats.confirmed), count: promoStats.confirmed, icon: CalendarCheck, urgent: false },
          { href: "/staff/reservations", label: "Seated", value: String(promoStats.seated), count: promoStats.seated, icon: Users, urgent: false },
          { href: "/staff/orders", label: "Revenue", value: formatMoney(promoStats.attributedRevenue), count: promoStats.attributedRevenue, icon: DollarSign, urgent: false },
        ]
      : [
          { href: "/staff/orders", label: "New orders", value: String(counts.pendingOrders), count: counts.pendingOrders, icon: Receipt, urgent: counts.pendingOrders > 0 },
          { href: "/staff/orders", label: "In progress", value: String(counts.activeOrders), count: counts.activeOrders, icon: Receipt, urgent: false },
          ...(!isRunner ? [{ href: "/staff/approvals", label: "Approvals", value: String(counts.pendingApprovals), count: counts.pendingApprovals, icon: UserCheck, urgent: counts.pendingApprovals > 0 }] : []),
          { href: "/staff/help", label: "Help requests", value: String(counts.openHelp), count: counts.openHelp, icon: LifeBuoy, urgent: counts.openHelp > 0 },
        ]
    : [];

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          Good evening{me ? `, ${me.name.split(" ")[0]}` : ""}
          <Moon className="size-4 text-primary" />
        </h1>
        {myZones.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> Your zones: {myZones.join(", ")}
          </p>
        )}
      </div>

      {me && <ClockCard staffId={me.id} />}

      {counts === null ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="stagger-children grid grid-cols-2 gap-3">
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
                  <p className="mt-3 text-3xl font-semibold tabular-nums"><CountUp value={tile.count} /></p>
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {isPromoter && promoStats && promoStats.guestsInHouse > 0 && (
        <Card className="border-primary/40 py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="size-4 text-primary" /> Guests in house
              </p>
              <p className="text-xs text-muted-foreground">
                {promoStats.guestsInHouse} from your reservations
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/staff/orders">
                Orders <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isRunner && (
        <Card className="py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="text-sm font-medium">My zones</p>
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
      )}

      {activeShow && (
        <Card className="border-primary/40 py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PartyPopper className="size-4 text-primary" /> Show floor busy
              </p>
              <p className="text-xs text-muted-foreground">
                {activeShow.tableCode} · {activeShow.label} · {activeShow.staffName}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/staff/orders">
                Open <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

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
