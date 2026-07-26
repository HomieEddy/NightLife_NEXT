import type { StaffRole, FeatureKey } from "./types";
import {
  Home,
  Receipt,
  UserCheck,
  LifeBuoy,
  MessageSquare,
  CalendarCheck,
  PartyPopper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------- Staff-panel nav per floor role ----------

export interface StaffNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
}

const BASE_NAV: StaffNavItem[] = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/orders", label: "Orders", icon: Receipt },
  { href: "/staff/approvals", label: "Approvals", icon: UserCheck },
  { href: "/staff/help", label: "Help", icon: LifeBuoy },
  { href: "/staff/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
];

const PROMOTER_NAV: StaffNavItem[] = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/orders", label: "Orders", icon: Receipt },
  { href: "/staff/approvals", label: "Approvals", icon: UserCheck },
  { href: "/staff/events", label: "Events", icon: PartyPopper },
  { href: "/staff/reservations", label: "Reservations", icon: CalendarCheck },
  { href: "/staff/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
];

const STAFF_NAV: Record<StaffRole, StaffNavItem[]> = {
  manager: BASE_NAV,
  host: BASE_NAV,
  bartender: BASE_NAV,
  runner: BASE_NAV,
  security: BASE_NAV,
  promoter: PROMOTER_NAV,
};

export function getStaffNav(role: StaffRole): StaffNavItem[] {
  return STAFF_NAV[role];
}

// ---------- Action capabilities per floor role ----------

export type StaffAction =
  | "order:claim"
  | "order:release"
  | "order:transition"
  | "order:gift"
  | "session:approve"
  | "session:deny"
  | "help:respond"
  | "reservation:create-own"
  | "reservation:edit-own"
  | "reservation:cancel-own"
  | "reservation:confirm-own";

const ROLE_ACTIONS: Record<StaffRole, ReadonlySet<StaffAction>> = {
  manager: new Set<StaffAction>([
    "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
  ]),
  host: new Set<StaffAction>([
    "order:claim", "order:release", "order:transition", "order:gift",
    "session:approve", "session:deny", "help:respond",
  ]),
  bartender: new Set<StaffAction>([
    "order:claim", "order:release", "order:transition",
    "help:respond",
  ]),
  runner: new Set<StaffAction>([
    "order:claim", "order:release", "order:transition",
    "help:respond",
  ]),
  security: new Set<StaffAction>([
    "help:respond",
  ]),
  promoter: new Set<StaffAction>([
    "reservation:create-own", "reservation:edit-own", "reservation:cancel-own",
    "reservation:confirm-own",
  ]),
};

export function canDo(role: StaffRole, action: StaffAction): boolean {
  return ROLE_ACTIONS[role].has(action);
}
