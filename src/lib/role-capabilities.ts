import type { StaffRole, FeatureKey, ChatMessage } from "./types";
import {
  Home,
  Receipt,
  UserCheck,
  LifeBuoy,
  MessageSquare,
  CalendarCheck,
  CalendarDays,
  PartyPopper,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// StaffAction type lives in permissions.ts (re-exported here for convenience).
export type { StaffAction } from "./permissions";

// ---------- Staff-panel nav per floor role ----------

export interface StaffNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
}

const SCHEDULE_ITEM: StaffNavItem = { href: "/staff/schedule", label: "Schedule", icon: CalendarDays };

const BASE_NAV: StaffNavItem[] = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/orders", label: "Orders", icon: Receipt },
  { href: "/staff/approvals", label: "Approvals", icon: UserCheck },
  { href: "/staff/help", label: "Help", icon: LifeBuoy },
  { href: "/staff/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
];

/** Runner: fulfillment only — no session approvals. */
const RUNNER_NAV: StaffNavItem[] = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/orders", label: "Orders", icon: Receipt },
  { href: "/staff/help", label: "Help", icon: LifeBuoy },
  SCHEDULE_ITEM,
  { href: "/staff/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
];

/** Security: trouble, hours, radio — no orders or approvals. */
const SECURITY_NAV: StaffNavItem[] = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/help", label: "Help", icon: Shield },
  SCHEDULE_ITEM,
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

/** All non-runner, non-security, non-promoter floor roles. */
const FLOOR_NAV: StaffNavItem[] = [
  ...BASE_NAV.slice(0, -1), // Home · Orders · Approvals · Help
  SCHEDULE_ITEM,
  { href: "/staff/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
];

const STAFF_NAV: Record<StaffRole, StaffNavItem[]> = {
  manager: FLOOR_NAV,
  host: FLOOR_NAV,
  bartender: FLOOR_NAV,
  runner: RUNNER_NAV,
  security: SECURITY_NAV,
  promoter: PROMOTER_NAV,
};

export function getStaffNav(role: StaffRole): StaffNavItem[] {
  return STAFF_NAV[role];
}

// ---------- Help-request scope per floor role ----------

/** Which help requests a role can see and respond to. */
export type HelpScope =
  | "all"             // manager, host — see every request
  | "assigned-zones"  // bartender, runner — requests in their assignedZoneIds (security type excluded for runner)
  | "security-only";  // security — only security-type requests

const HELP_SCOPE: Record<StaffRole, HelpScope> = {
  manager: "all",
  host: "all",
  bartender: "assigned-zones",
  runner: "assigned-zones",
  security: "security-only",
  promoter: "all", // promoters don't have help:respond but see context
};

export function getHelpScope(role: StaffRole): HelpScope {
  return HELP_SCOPE[role];
}

// ---------- Chat channel pinning per floor role ----------

/** Returns the channel a role is pinned to, or null for free choice. */
export function getPinnedChatChannel(role: StaffRole): ChatMessage["channel"] | null {
  if (role === "security") return "security";
  return null;
}
