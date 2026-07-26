"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, PartyPopper } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, EventActionGold } from "@/components/shared/event-card";
import { eventsService } from "@/lib/services/events-service";
import { reservationService } from "@/lib/services/reservation-service";
import { staffService } from "@/lib/services/staff-service";
import { useLiveEvents } from "@/lib/use-live-events";
import type { VenueEvent, StaffMember } from "@/lib/types";

interface EventWithTally extends VenueEvent {
  myReservations: number;
}

export default function StaffEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventWithTally[] | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);

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

  if (!events || !me) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Events</h1>

      {events.length === 0 && (
        <EmptyState icon={PartyPopper} title="No upcoming events" />
      )}

      {events.map((evt) => (
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
            me.role === "promoter" ? (
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
