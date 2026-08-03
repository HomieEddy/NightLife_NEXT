"use client";

import { useTranslations } from "next-intl";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import { QueryErrorState } from "@/components/shared/query-error-state";
import { doorService } from "@/features/door/services";
import { incidentService } from "@/features/safety/services";
import { ordersService } from "@/features/ordering/services";
import { guestsService } from "@/features/guests/services";
import { menuService } from "@/features/menu/services";
import { reservationService } from "@/features/hospitality/reservation-service";
import { showQueueService } from "@/features/realtime/show-queue-service";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { staffKeys } from "@/features/workforce/query-keys";
import { ordersKeys } from "@/features/ordering/query-keys";
import { sessionsKeys, helpRequestKeys } from "@/features/guests/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { menuKeys } from "@/features/menu/query-keys";
import { showQueueKeys } from "@/features/realtime/query-keys";
import { useAuth } from "@/context/auth-context";
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
  const t = useTranslations("staff.dashboard");
  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          {t("greetingName", { name: me.name.split(" ")[0] })}
          <Shield className="size-4 text-primary" />
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("securityTagline")}</p>
      </div>

      {/* Door + incidents — the actual job */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/staff/door">
          <Card className="h-full py-4 transition-colors hover:border-primary/50">
            <CardContent className="px-4">
              <DoorOpen className="size-4 text-primary" />
              <p className="mt-2 text-2xl sm:text-3xl font-semibold tabular-nums">
                {occupancy ? occupancy.current : "…"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("occupancy")}{occupancy ? ` / ${occupancy.legalCapacity}` : ""}
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
              <p className="mt-2 text-2xl sm:text-3xl font-semibold tabular-nums">{openIncidentCount}</p>
              <p className="text-xs text-muted-foreground">{t("openIncidents")}</p>
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
              <p className="mt-2 text-2xl sm:text-3xl font-semibold tabular-nums">{openSecurityCount}</p>
              <p className="text-xs text-muted-foreground">{t("openSecurityRequests")}</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Tonight's shift */}
      <Card className="py-4">
        <CardContent className="space-y-2 px-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" /> {t("tonightsShift")}
          </p>
          {todayShifts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noShiftToday")}</p>
          ) : (
            todayShifts.map((shift) => (
              <div key={shift.id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                {shift.startTime} – {shift.endTime}
              </div>
            ))
          )}
          <Button size="sm" variant="outline" asChild className="mt-1">
            <Link href="/staff/schedule">{t("fullSchedule")} <ArrowRight className="size-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>

      {/* Latest security broadcasts */}
      {securityBroadcasts.length > 0 && (
        <Card className="py-4">
          <CardContent className="space-y-2 px-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MessageSquare className="size-4 text-primary" /> {t("securityChannel")}
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
              <Link href="/staff/chat">{t("openChat")} <ArrowRight className="size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Main home ----------

export default function StaffHomePage() {
  const t = useTranslations("staff.dashboard");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const { data: me, isError: meError } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: orders, isError: ordersError } = useQuery({
    queryKey: ordersKeys.all(venueId),
    queryFn: () => ordersService.listOrders(),
    enabled: !!venueId,
  });

  const { data: pendingSessions } = useQuery({
    queryKey: sessionsKeys.byStatus(venueId, "pending"),
    queryFn: () => guestsService.listSessions("pending"),
    enabled: !!venueId,
  });

  const { data: helpRequests } = useQuery({
    queryKey: helpRequestKeys.all(venueId),
    queryFn: () => guestsService.listHelpRequests(),
    enabled: !!venueId,
  });

  const { data: zones } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: soldOut } = useQuery({
    queryKey: menuKeys.soldOut(venueId),
    queryFn: () => menuService.listSoldOutEvents(),
    enabled: !!venueId,
  });

  const { data: activeShow } = useQuery({
    queryKey: showQueueKeys.active(venueId),
    queryFn: () => showQueueService.getActiveShow(),
    enabled: !!venueId,
  });

  // Security-specific queries
  const isSecurity = me?.role === "security";

  const { data: allShifts } = useQuery({
    queryKey: staffKeys.shifts(venueId),
    queryFn: () => staffService.listShifts(),
    enabled: !!venueId && isSecurity,
  });

  const { data: securityMessages } = useQuery({
    queryKey: staffKeys.messages(venueId, "security"),
    queryFn: () => staffService.listMessages("security"),
    enabled: !!venueId && isSecurity,
  });

  const { data: occupancy } = useQuery({
    queryKey: ["door", venueId, "occupancy"],
    queryFn: () => doorService.getOccupancy(),
    enabled: !!venueId && isSecurity,
  });

  const { data: openIncidents } = useQuery({
    queryKey: ["incidents", venueId, "open"],
    queryFn: () => incidentService.listIncidents({ status: "open" }),
    enabled: !!venueId && isSecurity,
  });

  // Promoter-specific queries
  const isPromoter = me?.role === "promoter";

  const { data: myReservations } = useQuery({
    queryKey: ["reservations", venueId, "mine", me?.id ?? ""],
    queryFn: () => reservationService.listMyReservations(me!.id),
    enabled: !!venueId && isPromoter && !!me,
  });

  const { data: allSessions } = useQuery({
    queryKey: sessionsKeys.all(venueId),
    queryFn: () => guestsService.listSessions(),
    enabled: !!venueId && isPromoter,
  });

  const invalidateExtras = () => {
    queryClient.invalidateQueries({ queryKey: menuKeys.soldOut(venueId) });
    queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    queryClient.invalidateQueries({ queryKey: ordersKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: helpRequestKeys.all(venueId) });
  };

  useLiveEvents({
    scope: "staff",
    onEvent: invalidateExtras,
    fallbackMs: 8000,
    fallbackRefresh: invalidateExtras,
  });

  const myZones = me && zones
    ? zones.filter((z) => me.assignedZoneIds.includes(z.id)).map((z: Zone) => z.name)
    : [];

  const isRunner = me?.role === "runner";

  const counts: QueueCounts | null = orders && pendingSessions && helpRequests
    ? {
        pendingOrders: orders.filter((o) => o.status === "pending").length,
        activeOrders: orders.filter((o) => ["accepted", "preparing", "ready"].includes(o.status)).length,
        pendingApprovals: pendingSessions.length,
        openHelp: helpRequests.filter((h) => h.status !== "resolved").length,
      }
    : null;

  const promoStats: PromoterStats | null =
    isPromoter && me && myReservations && allSessions && orders
      ? computePromoterStats(myReservations, allSessions, orders, me.id)
      : null;

  const today = new Date().getDay();
  const todayShifts = allShifts && me
    ? allShifts.filter((s) => s.staffId === me.id && s.dayOfWeek === today)
    : [];
  const securityBroadcasts = securityMessages ? securityMessages.slice(-3).reverse() : [];
  const openSecurityCount = helpRequests
    ? helpRequests.filter((h) => h.type === "security" && h.status !== "resolved").length
    : 0;
  const openIncidentCount = openIncidents?.length ?? 0;

  // A failed core load (DB down) — no perpetual skeleton, no empty dashboard.
  if (meError || ordersError) {
    return (
      <div className="animate-fade-in space-y-5 p-4">
        <QueryErrorState
          queryKeys={[staffKeys.me(venueId), ordersKeys.all(venueId)]}
        />
      </div>
    );
  }

  // Security home delegates to its own component once data is ready.
  if (isSecurity && me && counts !== null) {
    return (
      <SecurityHome
        me={me}
        openSecurityCount={openSecurityCount}
        todayShifts={todayShifts}
        securityBroadcasts={securityBroadcasts}
        occupancy={occupancy ?? null}
        openIncidentCount={openIncidentCount}
      />
    );
  }

  const tiles = counts
    ? isPromoter && promoStats
      ? [
          { href: "/staff/reservations", label: t("tileRequested"), value: String(promoStats.requested), count: promoStats.requested, icon: CalendarCheck, urgent: false },
          { href: "/staff/reservations", label: t("tileConfirmed"), value: String(promoStats.confirmed), count: promoStats.confirmed, icon: CalendarCheck, urgent: false },
          { href: "/staff/reservations", label: t("tileSeated"), value: String(promoStats.seated), count: promoStats.seated, icon: Users, urgent: false },
          { href: "/staff/orders", label: t("tileRevenue"), value: formatMoney(promoStats.attributedRevenue), count: promoStats.attributedRevenue, icon: DollarSign, urgent: false },
        ]
      : [
          { href: "/staff/orders", label: t("tileNewOrders"), value: String(counts.pendingOrders), count: counts.pendingOrders, icon: Receipt, urgent: counts.pendingOrders > 0 },
          { href: "/staff/orders", label: t("tileInProgress"), value: String(counts.activeOrders), count: counts.activeOrders, icon: Receipt, urgent: false },
          ...(!isRunner ? [{ href: "/staff/approvals", label: t("tileApprovals"), value: String(counts.pendingApprovals), count: counts.pendingApprovals, icon: UserCheck, urgent: counts.pendingApprovals > 0 }] : []),
          { href: "/staff/help", label: t("tileHelpRequests"), value: String(counts.openHelp), count: counts.openHelp, icon: LifeBuoy, urgent: counts.openHelp > 0 },
        ]
    : [];

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          {me ? t("greetingName", { name: me.name.split(" ")[0] }) : t("greeting")}
          <Moon className="size-4 text-primary" />
        </h1>
        {myZones.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> {t("yourZones", { zones: myZones.join(", ") })}
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
                  <p className="mt-3 text-2xl sm:text-3xl font-semibold tabular-nums"><CountUp value={tile.count} startOnMount /></p>
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
                <Users className="size-4 text-primary" /> {t("guestsInHouse")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("guestsFromReservations", { count: promoStats.guestsInHouse })}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/staff/orders">
                {t("orders")} <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isRunner && (
        <Card className="py-4">
          <CardContent className="flex items-center justify-between px-4">
            <div>
              <p className="text-sm font-medium">{t("myZones")}</p>
              <p className="text-xs text-muted-foreground">
                {t("myZonesDesc")}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/staff/orders?scope=mine">
                {t("open")} <ArrowRight className="size-3.5" />
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
                <PartyPopper className="size-4 text-primary" /> {t("showFloorBusy")}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeShow.tableCode} · {activeShow.label} · {activeShow.staffName}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/staff/orders">
                {t("open")} <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {soldOut && soldOut.length > 0 && (
        <Card className="border-red-500/30 py-4">
          <CardContent className="space-y-2 px-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <AlertOctagon className="size-4 text-red-600 dark:text-red-400" /> {t("eightySixdTonight")}
            </p>
            <ul className="space-y-1">
              {(soldOut as SoldOutEvent[]).slice(0, 5).map((event) => (
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
