import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cog,
  CreditCard,
  DoorOpen,
  FileText,
  Gift,
  Globe,
  Headset,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Map,
  Martini,
  Megaphone,
  MessageSquare,
  PartyPopper,
  Percent,
  QrCode,
  Radio,
  Receipt,
  RefreshCcw,
  Search,
  ShoppingCart,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { useTranslations } from "next-intl";

// ── i18n ───────────────────────────────────────────────────────────
// Guide content lives in messages/{en,fr}.json under `demo.*`; the data
// below carries icons, hrefs and the English `title` (slug source for
// anchors), while display text resolves through these typed key builders.
// The single cast is the price of deriving keys from data — the mapping is
// covered by demo-guide-content.test.ts.

export type DemoMessageKey = Parameters<ReturnType<typeof useTranslations<"demo">>>[0];

type DemoField = "title" | "what" | "why" | "tryPath";

export const demoKeys = {
  group: (id: string, field: "label" | "intro"): DemoMessageKey =>
    `groups.${id}.${field}` as DemoMessageKey,
  feature: (
    feature: Pick<DemoFeature, "surface" | "title">,
    field: DemoField,
  ): DemoMessageKey => `features.${featureAnchorId(feature)}.${field}` as DemoMessageKey,
  walkthrough: (id: string, field: "step" | "detail" | "linkLabel"): DemoMessageKey =>
    `walkthrough.${id}.${field}` as DemoMessageKey,
  rule: (id: string, field: "title" | "line" | "linkLabel"): DemoMessageKey =>
    `houseRules.${id}.${field}` as DemoMessageKey,
};

// ── Types ──────────────────────────────────────────────────────────

export type Surface = "manager" | "staff" | "guest" | "public";

export interface DemoFeature {
  icon: LucideIcon;
  /** English title — slug source for anchor ids, never displayed directly. */
  title: string;
  href: string;
  surface: Surface;
}

export interface DemoGroup {
  id: string;
  icon: LucideIcon;
  features: DemoFeature[];
}

export interface WalkthroughStep {
  id: string;
  href: string;
}

export interface HouseRule {
  id: string;
  icon: LucideIcon;
  href?: string;
}

// ── Anchor slugs ───────────────────────────────────────────────────

/** Strips diacritics/punctuation to hyphen-safe, collision-resistant slugs. */
function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Anchor id for a feature block. Scoped by surface — several titles repeat
 * across surfaces (Tips, Incidents, Settings…), and an unscoped slug makes
 * two different sections resolve to the same `#id`.
 */
export function featureAnchorId(feature: Pick<DemoFeature, "surface" | "title">): string {
  return `${feature.surface}-${slugify(feature.title)}`;
}

// ── Walkthrough ────────────────────────────────────────────────────

export const WALKTHROUGH: WalkthroughStep[] = [
  {
    id: "order",
    href: "/g/demo-table",
  },
  {
    id: "staff",
    href: "/staff/orders",
  },
  {
    id: "door",
    href: "/staff/door",
  },
  {
    id: "pulse",
    href: "/manager/pulse",
  },
  {
    id: "money",
    href: "/manager/cashout",
  },
];

// ── House rules ────────────────────────────────────────────────────

export const HOUSE_RULES: HouseRule[] = [
  {
    id: "signIn",
    icon: KeyRound,
    href: "/login",
  },
  {
    id: "fresh",
    icon: RefreshCcw,
  },
  {
    id: "playOtherSide",
    icon: Sparkles,
  },
  {
    id: "palette",
    icon: Search,
  },
];

// ── Feature groups ─────────────────────────────────────────────────

export const DEMO_GROUPS: DemoGroup[] = [
  // ── Getting Started ──────────────────────────────────────────────
  {
    id: "getting-started",    icon: Sparkles,    features: [
      {
        icon: QrCode,
        title: "Demo QR code",        href: "/g/demo-table",
        surface: "guest",
      },
    ],
  },
  {
    id: "getting-started-extra",    icon: Sparkles,    features: [
      {
        icon: LayoutDashboard,
        title: "Manager panel",        href: "/manager",
        surface: "manager",
      },
      {
        icon: Smartphone,
        title: "Staff panel",        href: "/staff",
        surface: "staff",
      },
    ],
  },
  // ── Manager ──────────────────────────────────────────────────────
  {
    id: "manager",    icon: LayoutDashboard,    features: [
      {
        icon: LayoutDashboard,
        title: "Dashboard",        href: "/manager",
        surface: "manager",
      },
      {
        icon: Radio,
        title: "Pulse — live attention feed",        href: "/manager/pulse",
        surface: "manager",
      },
      {
        icon: Receipt,
        title: "Orders feed",        href: "/manager/orders",
        surface: "manager",
      },
      {
        icon: Map,
        title: "Interactive floor map",        href: "/manager/floor-map",
        surface: "manager",
      },
      {
        icon: Map,
        title: "Tables",        href: "/manager/tables",
        surface: "manager",
      },
      {
        icon: Map,
        title: "Zones",        href: "/manager/zones",
        surface: "manager",
      },
      {
        icon: QrCode,
        title: "QR codes",        href: "/manager/qr",
        surface: "manager",
      },
      {
        icon: Martini,
        title: "Menu & packages",        href: "/manager/menu",
        surface: "manager",
      },
      {
        icon: Percent,
        title: "Happy hour",        href: "/manager/happy-hour",
        surface: "manager",
      },
      {
        icon: Megaphone,
        title: "Promotions",        href: "/manager/promotions",
        surface: "manager",
      },
      {
        icon: ClipboardList,
        title: "Inventory",        href: "/manager/inventory",
        surface: "manager",
      },
      {
        icon: ShoppingCart,
        title: "Purchasing",        href: "/manager/purchasing",
        surface: "manager",
      },
      {
        icon: ClipboardCheck,
        title: "Stocktake & variance",        href: "/manager/inventory",
        surface: "manager",
      },
      {
        icon: Users,
        title: "Guests & CRM",        href: "/manager/guests",
        surface: "manager",
      },
      {
        icon: CalendarDays,
        title: "Reservations",        href: "/manager/reservations",
        surface: "manager",
      },
      {
        icon: PartyPopper,
        title: "Events",        href: "/manager/events",
        surface: "manager",
      },
      {
        icon: AlertTriangle,
        title: "Incidents",        href: "/manager/incidents",
        surface: "manager",
      },
      {
        icon: Users,
        title: "Staff & scheduling",        href: "/manager/staff",
        surface: "manager",
      },
      {
        icon: Calculator,
        title: "Tips",        href: "/manager/tips",
        surface: "manager",
      },
      {
        icon: Banknote,
        title: "Commission",        href: "/manager/commission",
        surface: "manager",
      },
      {
        icon: CreditCard,
        title: "Cash-out",        href: "/manager/cashout",
        surface: "manager",
      },
      {
        icon: BarChart3,
        title: "Analytics",        href: "/manager/analytics",
        surface: "manager",
      },
      {
        icon: FileText,
        title: "Reports",        href: "/manager/reports",
        surface: "manager",
      },
      {
        icon: ListChecks,
        title: "Audit trail",        href: "/manager/audit",
        surface: "manager",
      },
      {
        icon: Cog,
        title: "Automations",        href: "/manager/automations",
        surface: "manager",
      },
      {
        icon: MessageSquare,
        title: "Team chat",        href: "/manager/chat",
        surface: "manager",
      },
      {
        icon: Cog,
        title: "Settings",        href: "/manager/settings",
        surface: "manager",
      },
      {
        icon: CreditCard,
        title: "Subscription",        href: "/manager/subscription",
        surface: "manager",
      },
      {
        icon: Sparkles,
        title: "Onboarding",        href: "/manager/onboarding",
        surface: "manager",
      },
    ],
  },
  // ── Staff ─────────────────────────────────────────────────────────
  {
    id: "staff",    icon: Smartphone,    features: [
      {
        icon: Bell,
        title: "Home — queues, clock & 86-board",        href: "/staff",
        surface: "staff",
      },
      {
        icon: Receipt,
        title: "Order feed",        href: "/staff/orders",
        surface: "staff",
      },
      {
        icon: DoorOpen,
        title: "Door — occupancy & admissions",        href: "/staff/door",
        surface: "staff",
      },
      {
        icon: UserCheck,
        title: "Approvals",        href: "/staff/approvals",
        surface: "staff",
      },
      {
        icon: Headset,
        title: "Help queue",        href: "/staff/help",
        surface: "staff",
      },
      {
        icon: AlertTriangle,
        title: "Incidents",        href: "/staff/incidents",
        surface: "staff",
      },
      {
        icon: MessageSquare,
        title: "Team chat",        href: "/staff/chat",
        surface: "staff",
      },
      {
        icon: CalendarDays,
        title: "Schedule",        href: "/staff/schedule",
        surface: "staff",
      },
      {
        icon: Calculator,
        title: "Tips",        href: "/staff/tips",
        surface: "staff",
      },
      {
        icon: PartyPopper,
        title: "Events",        href: "/staff/events",
        surface: "staff",
      },
      {
        icon: CalendarDays,
        title: "Reservations",        href: "/staff/reservations",
        surface: "staff",
      },
      {
        icon: Bell,
        title: "Notifications",        href: "/staff/notifications",
        surface: "staff",
      },
    ],
  },
  // ── Guest ─────────────────────────────────────────────────────────
  {
    id: "guest",    icon: QrCode,    features: [
      {
        icon: Martini,
        title: "Menu & ordering",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: ShoppingCart,
        title: "Cart",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Receipt,
        title: "Orders",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Headset,
        title: "Help",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Gift,
        title: "Send a bottle",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Receipt,
        title: "Receipt & tab close",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Clock,
        title: "Waiting / host approval",        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: KeyRound,
        title: "Reservation PIN gate",        href: "/g/demo-table",
        surface: "guest",
      },
    ],
  },
  // ── Public ────────────────────────────────────────────────────────
  {
    id: "public",    icon: Globe,    features: [
      {
        icon: Globe,
        title: "Public venue page",        href: "/e/velvet-montreal",
        surface: "public",
      },
      {
        icon: CalendarDays,
        title: "Public reservations",        href: "/r/velvet-montreal",
        surface: "public",
      },
    ],
  },
  // ── How the demo works ────────────────────────────────────────────
  {
    id: "how-it-works",    icon: Search,    features: [],
  },
];
