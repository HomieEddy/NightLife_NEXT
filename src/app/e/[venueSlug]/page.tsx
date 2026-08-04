"use client";

import { Suspense, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { CalendarCheck, ChevronLeft, ChevronRight, PartyPopper, Ticket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import {
  EventCard,
  EventActionGold,
} from "@/components/shared/event-card";
import { eventsService } from "@/features/hospitality/events-service";
import { eventsKeys } from "@/features/hospitality/query-keys";
import { publicReservationHref } from "@/features/shared/entity-links";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string, locale = "en"): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return monthKey(d);
}

export default function PublicEventsPage({
  params,
}: {
  params: Promise<{ venueSlug: string }>;
}) {
  const { venueSlug } = use(params);
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-4 p-4 pt-10">
          <Skeleton className="mx-auto h-8 w-48" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      }
    >
      <EventsContent venueSlug={venueSlug} />
    </Suspense>
  );
}

function EventsContent({ venueSlug }: { venueSlug: string }) {
  const router = useRouter();
  const locale = useLocale();
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const { data, isPending } = useQuery({
    queryKey: eventsKeys.publicList(venueSlug),
    queryFn: () => eventsService.listPublicEvents(venueSlug),
  });

  const venueName = data?.venueName ?? null;
  const events = data?.events ?? null;

  const visible = useMemo(
    () => events?.filter((evt) => evt.startsAt.slice(0, 7) === month) ?? null,
    [events, month],
  );

  // notFound: data resolved to null (venue not found)
  if (data === null) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-4">
        <EmptyState
          icon={PartyPopper}
          title="Venue not found"
          description="This events page doesn't exist."
        />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 pt-10">
        <Skeleton className="mx-auto h-8 w-48" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pt-8">
      <div className="text-center">
        <BrandLogo href={`/e/${venueSlug}`} className="justify-center" />
        {venueName && (
          <h1 className="text-display mt-3 text-2xl">{venueName}</h1>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming events
        </p>
      </div>

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
        <span className="text-sm font-medium">{monthLabel(month, locale)}</span>
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

      {visible && visible.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="No events this month"
          description="Check back later for new events."
        />
      ) : (
        <div className="space-y-3">
          {visible?.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              locale={locale}
              actions={
                evt.status !== "ended" ? (
                  <>
                    {evt.ticketUrl && (
                      <EventActionGold
                        onClick={() =>
                          window.open(evt.ticketUrl, "_blank", "noopener,noreferrer")
                        }
                      >
                        <Ticket className="size-3.5" /> Buy tickets
                      </EventActionGold>
                    )}
                    <EventActionGold
                      onClick={() =>
                        router.push(
                          publicReservationHref(venueSlug, undefined, evt.id),
                        )
                      }
                    >
                      <CalendarCheck className="size-3.5" /> Reserve
                    </EventActionGold>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
