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
  labelKey?: string;
  icon: LucideIcon;
  feature?: FeatureKey;
}

export interface NavGroup {
  label: string;
  labelKey?: string;
  defaultCollapsed?: boolean;
  items: NavItem[];
}

/** Single source of truth — consumed by desktop sidebar, mobile More sheet and the command palette. */
export const MANAGER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Tonight",
    labelKey: "nav.groups.tonight",
    items: [
      { href: "/manager", label: "Dashboard", labelKey: "nav.items.dashboard", icon: LayoutDashboard },
      { href: "/manager/orders", label: "Orders", labelKey: "nav.items.orders", icon: Receipt },
      { href: "/manager/pulse", label: "Pulse", labelKey: "nav.items.pulse", icon: AlertTriangle },
      { href: "/manager/chat", label: "Chat", labelKey: "nav.items.chat", icon: MessageSquare, feature: "chat" },
    ],
  },
  {
    label: "Floor",
    labelKey: "nav.groups.floor",
    items: [
      { href: "/manager/floor-map", label: "Floor map", labelKey: "nav.items.floorMap", icon: Map, feature: "floor-map" },
      { href: "/manager/zones", label: "Zones", labelKey: "nav.items.zones", icon: MapPin },
      { href: "/manager/tables", label: "Tables", labelKey: "nav.items.tables", icon: Table2 },
      { href: "/manager/qr", label: "QR codes", labelKey: "nav.items.qrCodes", icon: QrCode },
    ],
  },
  {
    label: "Catalogue",
    labelKey: "nav.groups.catalogue",
    items: [
      { href: "/manager/menu", label: "Menu", labelKey: "nav.items.menu", icon: Martini },
      { href: "/manager/inventory", label: "Inventory", labelKey: "nav.items.inventory", icon: Boxes, feature: "inventory" },
      { href: "/manager/purchasing", label: "Purchasing", labelKey: "nav.items.purchasing", icon: ShoppingCart },
      { href: "/manager/happy-hour", label: "Happy hour", labelKey: "nav.items.happyHour", icon: Clock, feature: "happy-hour" },
      { href: "/manager/promotions", label: "Promotions", labelKey: "nav.items.promotions", icon: Tag, feature: "promotions" },
    ],
  },
  {
    label: "Bookings",
    labelKey: "nav.groups.bookings",
    items: [
      { href: "/manager/reservations", label: "Reservations", labelKey: "nav.items.reservations", icon: CalendarDays, feature: "reservations" },
      { href: "/manager/events", label: "Events", labelKey: "nav.items.events", icon: PartyPopper, feature: "events" },
      { href: "/manager/guests", label: "Guests", labelKey: "nav.items.guests", icon: UserSquare2, feature: "guest-crm" },
    ],
  },
  {
    label: "Team",
    labelKey: "nav.groups.team",
    items: [
      { href: "/manager/staff", label: "Staff", labelKey: "nav.items.staff", icon: Users },
      { href: "/manager/tips", label: "Tips", labelKey: "nav.items.tips", icon: Wallet },
      { href: "/manager/commission", label: "Commission", labelKey: "nav.items.commission", icon: Wallet, feature: "reservations" },
    ],
  },
  {
    label: "Insights",
    labelKey: "nav.groups.insights",
    defaultCollapsed: true,
    items: [
      { href: "/manager/analytics", label: "Analytics", labelKey: "nav.items.analytics", icon: BarChart3, feature: "analytics" },
      { href: "/manager/automations", label: "Automations", labelKey: "nav.items.automations", icon: Bot },
      { href: "/manager/reports", label: "Reports", labelKey: "nav.items.reports", icon: FileText, feature: "reports" },
      { href: "/manager/incidents", label: "Incidents", labelKey: "nav.items.incidents", icon: AlertTriangle, feature: "incidents" },
      { href: "/manager/cashout", label: "Cash-out", labelKey: "nav.items.cashOut", icon: Wallet },
      { href: "/manager/audit", label: "Audit trail", labelKey: "nav.items.auditTrail", icon: ListChecks },
    ],
  },
];

/** Footer items — always visible, never in the scroll. */
export const MANAGER_FOOTER_ITEMS: NavItem[] = [
  { href: "/manager/settings", label: "Settings", labelKey: "nav.items.settings", icon: Settings },
];

export const DEMO_FOOTER_ITEMS: NavItem[] = [
  { href: "/manager/settings", label: "Settings", labelKey: "nav.items.settings", icon: Settings },
  { href: "/manager/subscription", label: "Subscription", labelKey: "nav.items.subscription", icon: CreditCard },
];

/** Admin area — horizontal pill nav at the top. Single group since admin is flat. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", labelKey: "nav.items.overview", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Lead pipeline", labelKey: "nav.items.leadPipeline", icon: Filter },
  { href: "/admin/venues", label: "Tenants", labelKey: "nav.items.tenants", icon: Building2 },
  { href: "/admin/onboarding", label: "Provisioning", labelKey: "nav.items.provisioning", icon: Rocket },
  { href: "/admin/plans", label: "Plans", labelKey: "nav.items.plans", icon: Layers },
  { href: "/admin/settings", label: "Settings", labelKey: "nav.items.settings", icon: Settings },
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
  if (href === "/manager" || href === "/staff") return pathname === href;
  const nextChar = pathname[href.length];
  return pathname.startsWith(href) && (nextChar === "/" || nextChar === undefined);
}
