import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  ListChecks,
  Map,
  MapPin,
  Martini,
  MessageSquare,
  PartyPopper,
  QrCode,
  Receipt,
  Settings,
  ShoppingCart,
  Table2,
  Tag,
  UserSquare2,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FeatureKey } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Single source of truth — consumed by desktop sidebar, mobile More sheet and the command palette. */
export const MANAGER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Tonight",
    items: [
      { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
      { href: "/manager/orders", label: "Orders", icon: Receipt },
      { href: "/manager/pulse", label: "Pulse", icon: AlertTriangle },
      { href: "/manager/chat", label: "Chat", icon: MessageSquare, feature: "chat" },
    ],
  },
  {
    label: "Floor",
    items: [
      { href: "/manager/floor-map", label: "Floor map", icon: Map, feature: "floor-map" },
      { href: "/manager/zones", label: "Zones", icon: MapPin },
      { href: "/manager/tables", label: "Tables", icon: Table2 },
      { href: "/manager/qr", label: "QR codes", icon: QrCode },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/manager/menu", label: "Menu", icon: Martini },
      { href: "/manager/inventory", label: "Inventory", icon: Boxes, feature: "inventory" },
      { href: "/manager/purchasing", label: "Purchasing", icon: ShoppingCart },
      { href: "/manager/happy-hour", label: "Happy hour", icon: Clock, feature: "happy-hour" },
      { href: "/manager/promotions", label: "Promotions", icon: Tag, feature: "promotions" },
    ],
  },
  {
    label: "Bookings",
    items: [
      { href: "/manager/reservations", label: "Reservations", icon: CalendarDays, feature: "reservations" },
      { href: "/manager/events", label: "Events", icon: PartyPopper, feature: "events" },
      { href: "/manager/guests", label: "Guests", icon: UserSquare2, feature: "guest-crm" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/manager/staff", label: "Staff", icon: Users },
      { href: "/manager/tips", label: "Tips", icon: Wallet },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/manager/analytics", label: "Analytics", icon: BarChart3, feature: "analytics" },
      { href: "/manager/reports", label: "Reports", icon: FileText, feature: "reports" },
      { href: "/manager/incidents", label: "Incidents", icon: AlertTriangle, feature: "incidents" },
      { href: "/manager/cashout", label: "Cash-out", icon: Wallet },
      { href: "/manager/audit", label: "Audit trail", icon: ListChecks },
    ],
  },
];

/** Footer items — always visible, never in the scroll. */
export const MANAGER_FOOTER_ITEMS: NavItem[] = [
  { href: "/manager/settings", label: "Settings", icon: Settings },
];

export const DEMO_FOOTER_ITEMS: NavItem[] = [
  { href: "/manager/settings", label: "Settings", icon: Settings },
  { href: "/manager/subscription", label: "Subscription", icon: CreditCard },
];

// ---------- Collapsible group state ----------

const COLLAPSED_KEY_PREFIX = "nlx-nav-collapsed-";

export function isGroupCollapsed(label: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`${COLLAPSED_KEY_PREFIX}${label}`) === "1";
}

export function setGroupCollapsed(label: string, collapsed: boolean): void {
  if (collapsed) localStorage.setItem(`${COLLAPSED_KEY_PREFIX}${label}`, "1");
  else localStorage.removeItem(`${COLLAPSED_KEY_PREFIX}${label}`);
}

// ---------- Active state ----------

/**
 * Active-state helper matching full segment boundaries — kills the two-
 * components-disagree bug before detail routes expose it.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/manager") return pathname === "/manager";
  const nextChar = pathname[href.length];
  return pathname.startsWith(href) && (nextChar === "/" || nextChar === undefined);
}
