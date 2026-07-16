"use client";

import Link from "next/link";
import { CalendarCheck, Map, Martini, PartyPopper, Table2, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  eventHref,
  menuCategoryHref,
  promotionHref,
  reservationHref,
  tableHref,
  zoneHref,
  zoneStaffHref,
  zoneTablesHref,
} from "@/lib/entity-links";

export type EntityChipType =
  | "zone" // → zones page, highlighted
  | "zone-tables" // → tables filtered to zone
  | "zone-staff" // → staff filtered to zone
  | "table" // → tables page, highlighted
  | "menu-category" // → menu filtered to category
  | "reservation" // → reservations page, highlighted
  | "event" // → events page, highlighted
  | "promotion"; // → promotions page, highlighted

const CONFIG: Record<EntityChipType, { icon: typeof Map; href: (id: string) => string }> = {
  zone: { icon: Map, href: zoneHref },
  "zone-tables": { icon: Table2, href: zoneTablesHref },
  "zone-staff": { icon: Users, href: zoneStaffHref },
  table: { icon: Table2, href: tableHref },
  "menu-category": { icon: Martini, href: menuCategoryHref },
  reservation: { icon: CalendarCheck, href: reservationHref },
  event: { icon: PartyPopper, href: eventHref },
  promotion: { icon: Tag, href: promotionHref },
};

/** Small link-wrapped badge for navigating entity relationships. */
export function EntityChip({
  type,
  id,
  label,
  className,
}: {
  type: EntityChipType;
  id: string;
  label: string;
  className?: string;
}) {
  const { icon: Icon, href } = CONFIG[type];
  return (
    <Link
      href={href(id)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        "text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </Link>
  );
}
