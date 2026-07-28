import {
  AlertTriangle,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Filter,
  Layers,
  LayoutDashboard,
  ListChecks,
  Map,
  MapPin,
  Martini,
  MessageSquare,
  PartyPopper,
  QrCode,
  Receipt,
  Rocket,
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
  defaultCollapsed?: boolean;
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
      { href: "/manager/commission", label: "Commission", icon: Wallet, feature: "reservations" },
    ],
  },
  {
    label: "Insights",
    defaultCollapsed: true,
    items: [
      { href: "/manager/analytics", label: "Analytics", icon: BarChart3, feature: "analytics" },
      { href: "/manager/automations", label: "Automations", icon: Bot },
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

/** Admin area — horizontal pill nav at the top. Single group since admin is flat. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Lead pipeline", icon: Filter },
  { href: "/admin/venues", label: "Tenants", icon: Building2 },
  { href: "/admin/onboarding", label: "Provisioning", icon: Rocket },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// ---------- Collapsible group state ----------

const COLLAPSED_KEY_PREFIX = "nlx-nav-collapsed-";

export function isGroupCollapsed(label: string): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(`${COLLAPSED_KEY_PREFIX}${label}`);
  if (stored !== null) return stored === "1";
  const group = MANAGER_NAV_GROUPS.find((g) => g.label === label);
  return group?.defaultCollapsed ?? false;
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
