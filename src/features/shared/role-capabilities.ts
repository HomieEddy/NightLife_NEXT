import type { StaffRole, FeatureKey, ChatMessage } from "@/lib/types";
import {
  Home,
  Receipt,
  UserCheck,
  LifeBuoy,
  MessageSquare,
  CalendarCheck,
  CalendarDays,
  PartyPopper,
  DoorOpen,
  AlertTriangle,
  DollarSign,
  BellRing,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  canDo,
  DEFAULT_ROLE_PERMISSIONS,
  type StaffAction,
  type RolePermissions,
} from "./permissions";

// StaffAction type + help-scope logic live in permissions.ts (the pure authz
// module); re-exported here for existing consumers.
export type { StaffAction, HelpScope } from "./permissions";
export { getHelpScope } from "./permissions";

// ---------- Staff-panel nav ----------

export interface StaffNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  /**
   * Hidden unless the role holds this action in the live RolePermissions.
   * Undefined ⇒ always shown. This is the single seam that keeps nav and
   * permissions from drifting: revoke the action in the role editor and the
   * nav entry disappears (plan 15 — one capability matrix feeds nav and API).
   */
  requiredAction?: StaffAction;
}

// One ordered list; per-role nav is this filtered by live permissions. The
// first four surviving items become the bottom-nav; the rest go under "More".
const ALL_NAV: StaffNavItem[] = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/orders", label: "Orders", icon: Receipt, requiredAction: "order:claim" },
  { href: "/staff/approvals", label: "Approvals", icon: UserCheck, requiredAction: "session:approve" },
  { href: "/staff/door", label: "Door", icon: DoorOpen, feature: "door", requiredAction: "door:admit" },
  { href: "/staff/incidents", label: "Incidents", icon: AlertTriangle, feature: "incidents", requiredAction: "incident:read-all" },
  { href: "/staff/reservations", label: "Reservations", icon: CalendarCheck, requiredAction: "reservation:create-own" },
  { href: "/staff/events", label: "Events", icon: PartyPopper, requiredAction: "reservation:create-own" },
  { href: "/staff/help", label: "Help", icon: LifeBuoy, requiredAction: "help:respond" },
  { href: "/staff/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/staff/tips", label: "Tips", icon: DollarSign },
  { href: "/staff/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
  { href: "/staff/notifications", label: "Notifications", icon: BellRing },
];

/**
 * Nav for a role, gated by its live permissions. `permissions` defaults to the
 * app defaults so callers that only need the shape (e.g. the command palette)
 * can omit it; the shell passes the venue's live matrix so overrides apply.
 */
export function getStaffNav(
  role: StaffRole,
  permissions: RolePermissions = DEFAULT_ROLE_PERMISSIONS,
): StaffNavItem[] {
  return ALL_NAV.filter(
    (item) => !item.requiredAction || canDo(permissions, role, item.requiredAction),
  );
}

// ---------- Chat channel pinning per floor role ----------

/** Returns the channel a role is pinned to, or null for free choice. */
export function getPinnedChatChannel(role: StaffRole): ChatMessage["channel"] | null {
  if (role === "security") return "security";
  return null;
}
