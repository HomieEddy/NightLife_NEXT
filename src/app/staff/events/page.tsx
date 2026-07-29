"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, EventActionGold } from "@/components/shared/event-card";
import { eventsService } from "@/features/hospitality/events-service";
import { reservationService } from "@/features/hospitality/reservation-service";
import { staffService } from "@/features/workforce/staff-service";
import { useLiveEvents } from "@/lib/use-live-events";
import type { VenueEvent, StaffMember } from "@/lib/types";

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
  const router = useRouter();
  const [events, setEvents] = useState<EventWithTally[] | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const refresh = useCallback(async () => {
    const [allEvents, staff] = await Promise.all([
      eventsService.listEvents(),
      staffService.getCurrentStaff(),
    ]);
    setMe(staff);

    const myRes = await reservationService.listMyReservations(staff.id);
    const published = allEvents.filter((e) => e.status !== "draft");

    const withTally: EventWithTally[] = published.map((evt) => ({
      ...evt,
      myReservations: myRes.filter((r) => r.eventId === evt.id).length,
    }));

    setEvents(withTally);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useLiveEvents({
    scope: "staff",
    onEvent: () => refresh(),
    fallbackMs: 8000,
    fallbackRefresh: () => refresh(),
  });

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
      <h1 className="text-display text-xl">Events</h1>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">{monthLabel(month)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {visible && visible.length === 0 && (
        <EmptyState icon={PartyPopper} title="No events this month" />
      )}

      {visible?.map((evt) => (
        <EventCard
          key={evt.id}
          event={evt}
          detail={
            me.role === "promoter" ? (
              <p className="text-xs font-medium text-primary">
                My reservations: {evt.myReservations}
              </p>
            ) : undefined
          }
          actions={
            me.role === "promoter" && evt.status !== "ended" ? (
              <EventActionGold onClick={() => router.push(`/staff/reservations?newForEvent=${evt.id}`)}>
                <CalendarCheck className="size-3.5" /> Book
              </EventActionGold>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
