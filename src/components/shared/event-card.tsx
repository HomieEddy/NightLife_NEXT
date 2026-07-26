"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VenueEvent } from "@/lib/types";

function eventDate(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    monthDay: d.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
  };
}

export function EventCard({
  event,
  zoneName,
  actions,
  detail,
  className,
}: {
  event: VenueEvent;
  zoneName?: string;
  /** Action buttons rendered below the card body. */
  actions?: ReactNode;
  /** Extra content between the header and actions (e.g. guestlist, reservation count). */
  detail?: ReactNode;
  className?: string;
}) {
  const { weekday, monthDay } = eventDate(event.startsAt);

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border border-gold/20 bg-card glow-gold",
        "dark:border-gold/15 dark:bg-[oklch(0.12_0.015_55)]",
        className,
      )}
    >
      {/* ── Gold date block ── */}
      <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-gold px-3 py-4 text-center">
        <span className="text-sm font-bold leading-tight text-[oklch(0.18_0.03_55)]">
          {weekday}
        </span>
        <span className="text-lg font-black leading-tight text-[oklch(0.12_0.02_50)]">
          {monthDay}
        </span>
      </div>

      {/* ── Content ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-foreground">
              {event.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
              {zoneName && <> · {zoneName}</>}
              {event.capacity > 0 && <> · Cap {event.capacity}</>}
            </p>
          </div>
          <StatusBadge status={event.status} />
        </div>

        {event.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {event.description}
          </p>
        )}

        {detail}

        {actions && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-gold/15 pt-2 dark:border-gold/10">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** Luxe gold action button — primary action style. */
export function EventActionGold({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
        "bg-gold text-[oklch(0.12_0.02_50)] shadow-sm",
        "hover:bg-gold-bright active:bg-gold-deep",
        "transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Chrome action button — secondary action style. */
export function EventActionChrome({
  children,
  onClick,
  className,
  destructive = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
        "border transition-colors",
        destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
