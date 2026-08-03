"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, EventActionGold } from "@/components/shared/event-card";
import { eventsService } from "@/features/hospitality/events-service";
import { reservationService } from "@/features/hospitality/reservation-service";
import { staffService } from "@/features/workforce/staff-service";
import { eventsKeys, reservationsKeys } from "@/features/hospitality/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { useLiveEvents } from "@/lib/use-live-events";
import type { VenueEvent } from "@/lib/types";

interface EventWithTally extends VenueEvent {
  myReservations: number;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return monthKey(d);
}

export default function StaffEventsPage() {
  const t = useTranslations("staff.events");
  const router = useRouter();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: eventsKeys.all(venueId) });
    queryClient.invalidateQueries({ queryKey: reservationsKeys.all(venueId) });
  };

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: allEvents } = useQuery({
    queryKey: eventsKeys.all(venueId),
    queryFn: () => eventsService.listEvents(),
    enabled: !!venueId,
  });

  const { data: myReservations } = useQuery({
    queryKey: reservationsKeys.mine(venueId, me?.id ?? ""),
    queryFn: () => reservationService.listMyReservations(me!.id),
    enabled: !!venueId && !!me,
  });

  useLiveEvents({
    scope: "staff",
    onEvent: invalidate,
    fallbackMs: 8000,
    fallbackRefresh: invalidate,
  });

  const events = useMemo((): EventWithTally[] | null => {
    if (!allEvents || !myReservations) return null;
    const published = allEvents.filter((e) => e.status !== "draft");
    return published.map((evt) => ({
      ...evt,
      myReservations: myReservations.filter((r) => r.eventId === evt.id).length,
    }));
  }, [allEvents, myReservations]);

  const visible = useMemo(
    () =>
      events?.filter((evt) => {
        const evtMonth = evt.startsAt.slice(0, 7);
        return evtMonth === month;
      }) ?? null,
    [events, month],
  );

  if (!events || !me) {
    return (
      <div className="animate-fade-in space-y-5 p-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in stagger-children space-y-5 p-4">
      <div>
        <h1 className="text-display text-xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex items-center justify-between">
        <TooltipIconButton
          variant="ghost"
          className="size-8"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          tooltip={t("prevMonth")}
        >
          <ChevronLeft className="size-4" />
        </TooltipIconButton>
        <span className="text-sm font-medium">{monthLabel(month)}</span>
        <TooltipIconButton
          variant="ghost"
          className="size-8"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          tooltip={t("nextMonth")}
        >
          <ChevronRight className="size-4" />
        </TooltipIconButton>
      </div>

      {visible && visible.length === 0 && (
        <EmptyState
          icon={PartyPopper}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      )}

      {visible?.map((evt) => (
        <EventCard
          key={evt.id}
          event={evt}
          detail={
            me.role === "promoter" ? (
              <p className="text-xs font-medium text-primary">
                {t("myReservations", { count: evt.myReservations })}
              </p>
            ) : undefined
          }
          actions={
            me.role === "promoter" && evt.status !== "ended" ? (
              <EventActionGold onClick={() => router.push(`/staff/reservations?newForEvent=${evt.id}`)}>
                <CalendarCheck className="size-3.5" /> {t("book")}
              </EventActionGold>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
