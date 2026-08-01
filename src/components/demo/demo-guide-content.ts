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

// ── Types ──────────────────────────────────────────────────────────

export type Surface = "manager" | "staff" | "guest" | "public";

export interface DemoFeature {
  icon: LucideIcon;
  title: string;
  /** One line — what this feature is. */
  what: string;
  /** 1–2 lines — why a nightclub needs it. */
  why: string;
  /** Breadcrumb-style click path, e.g. "Manager sidebar > Pulse". */
  tryPath: string;
  href: string;
  surface: Surface;
}

export interface DemoGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  intro: string;
  features: DemoFeature[];
}

export interface WalkthroughStep {
  step: string;
  detail: string;
  href: string;
  linkLabel: string;
}

export interface HouseRule {
  icon: LucideIcon;
  title: string;
  line: string;
  href?: string;
  linkLabel?: string;
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
    step: "Order as a guest",
    detail:
      "Scan the demo table, join with any name, approve yourself, browse bottle packages, and place an order. Watch fees itemize live in the cart.",
    href: "/g/demo-table",
    linkLabel: "Guest QR",
  },
  {
    step: "Work it as staff",
    detail:
      "Open the staff order feed, claim the order you just placed, clock in, and walk it through pending to delivered — the guest sees every step.",
    href: "/staff/orders",
    linkLabel: "Staff orders",
  },
  {
    step: "Work the door",
    detail:
      "Check the live occupancy counter, search for a reservation, admit a walk-in with ID check and party-size stepper.",
    href: "/staff/door",
    linkLabel: "Staff door",
  },
  {
    step: "Watch the pulse as manager",
    detail:
      "Check Pulse for anything running late — overdue orders, open incidents, capacity warnings, SLA-aged attention items.",
    href: "/manager/pulse",
    linkLabel: "Pulse",
  },
  {
    step: "Manage the money",
    detail:
      "Comp a bottle, check pour cost, run a stocktake, close out a shift, and compute tonight's tip distribution.",
    href: "/manager/cashout",
    linkLabel: "Cash-out",
  },
];

// ── House rules ────────────────────────────────────────────────────

export const HOUSE_RULES: HouseRule[] = [
  {
    icon: KeyRound,
    title: "Sign in as anyone",
    line: "One-tap personas. Any PIN works — manager, host, bartender, runner, security, promoter.",
    href: "/login",
    linkLabel: "Go to login",
  },
  {
    icon: RefreshCcw,
    title: "Fresh every visit",
    line: "Reload resets the night — use in-app links to travel between surfaces without losing state.",
  },
  {
    icon: Sparkles,
    title: "Play the other side",
    line: "\"Simulate\" buttons stand in for host approval, kitchen, and external systems — real flows, mock actions.",
  },
  {
    icon: Search,
    title: "Ctrl+K for command palette",
    line: "Search orders, tables, staff, menu, reservations — or jump directly to any page in the demo.",
  },
];

// ── Feature groups ─────────────────────────────────────────────────

export const DEMO_GROUPS: DemoGroup[] = [
  // ── Getting Started ──────────────────────────────────────────────
  {
    id: "getting-started",
    label: "Getting started",
    icon: Sparkles,
    intro:
      "The fastest way to feel the whole loop — one order travelling guest to staff to manager, in five minutes. Use in-app links between steps so the night doesn't reset.",
    features: [
      {
        icon: QrCode,
        title: "Demo QR code",
        what: "Scan or click to enter the guest experience at the demo table.",
        why: "Every table in a real venue has a unique QR. Guests scan, join, and order without downloading an app.",
        tryPath: "Scan below or click",
        href: "/g/demo-table",
        surface: "guest",
      },
    ],
  },
  {
    id: "getting-started-extra",
    label: "Getting started",
    icon: Sparkles,
    intro: "",
    features: [
      {
        icon: LayoutDashboard,
        title: "Manager panel",
        what: "The venue control room — sidebar navigation, desktop-first, every operational surface.",
        why: "One person runs the night from here: orders, floor map, inventory, staff, money. First visit opens a setup wizard you can skip or complete.",
        tryPath: "Open /manager",
        href: "/manager",
        surface: "manager",
      },
      {
        icon: Smartphone,
        title: "Staff panel",
        what: "Mobile-first floor crew app — bottom tab bar, large touch targets, broadcast banners you can't miss mid-shift.",
        why: "Runners, bartenders, hosts, and security each see their role's surface. No training needed — it's a phone app.",
        tryPath: "Open /staff",
        href: "/staff",
        surface: "staff",
      },
    ],
  },
  // ── Manager ──────────────────────────────────────────────────────
  {
    id: "manager",
    label: "Manager",
    icon: LayoutDashboard,
    intro:
      "Every operational surface a nightclub GM needs — desktop-first, sidebar navigation, prefilled setup wizard on first visit.",
    features: [
      {
        icon: LayoutDashboard,
        title: "Dashboard",
        what: "Tonight at a glance — revenue, occupancy, open orders, active staff, attention items.",
        why: "The GM's first screen every shift. Nights peak Thursday through Sunday; the dashboard surfaces what needs attention now.",
        tryPath: "Manager sidebar > Dashboard",
        href: "/manager",
        surface: "manager",
      },
      {
        icon: Radio,
        title: "Pulse — live attention feed",
        what: "SLA-aged attention queue with overdue escalation, staff broadcasts, one-tap last call.",
        why: "An order sitting pending for 12 minutes kills the guest experience. Pulse surfaces what's late before the guest complains.",
        tryPath: "Manager sidebar > Pulse",
        href: "/manager/pulse",
        surface: "manager",
      },
      {
        icon: Receipt,
        title: "Orders feed",
        what: "Every order filterable by zone, table, and status — session tabs with transfers, merges, and tab adjustments.",
        why: "Bottle service means high-value orders across dozens of tables. One feed keeps the floor manager in control.",
        tryPath: "Manager sidebar > Orders",
        href: "/manager/orders",
        surface: "manager",
      },
      {
        icon: Map,
        title: "Interactive floor map",
        what: "Tap any table for live status, session, and order history — drag tables to reconfigure the floor.",
        why: "A club floor changes nightly. VIP sections expand for events, tables move for large parties. The map IS the config.",
        tryPath: "Manager sidebar > Floor Map",
        href: "/manager/floor-map",
        surface: "manager",
      },
      {
        icon: Map,
        title: "Tables",
        what: "Table list with codes, zones, capacity, minimum spend, and status — filterable and bulk-editable.",
        why: "Tables carry minimum spend commitments. A VIP table at $800 minimum needs tracking separate from the rail.",
        tryPath: "Manager sidebar > Tables",
        href: "/manager/tables",
        surface: "manager",
      },
      {
        icon: Map,
        title: "Zones",
        what: "Zone management — VIP, main floor, rooftop, terrace — each with its own capacity and pricing rules.",
        why: "Different zones carry different economics. The rooftop might have a separate minimum and bottle markup.",
        tryPath: "Manager sidebar > Zones",
        href: "/manager/zones",
        surface: "manager",
      },
      {
        icon: QrCode,
        title: "QR codes",
        what: "Per-table QR code generation — copy, download, print the sheet for table tents.",
        why: "Every table gets a unique QR. Print the sheet before doors, replace damaged ones — guests scan and order.",
        tryPath: "Manager sidebar > QR Codes",
        href: "/manager/qr",
        surface: "manager",
      },
      {
        icon: Martini,
        title: "Menu & packages",
        what: "Bottles, curated packages (Table Starter through Legacy), modifiers, and category management.",
        why: "Bottle markup drives nightclub revenue. Packages bundle high-margin bottles with mixers at a single price point.",
        tryPath: "Manager sidebar > Menu",
        href: "/manager/menu",
        surface: "manager",
      },
      {
        icon: Percent,
        title: "Happy hour",
        what: "Time-boxed discount rules — percentage off, fixed price, or BOGO — by day of week and hour range.",
        why: "Early-evening discounts fill tables before the peak. Rules stack predictably and expire automatically.",
        tryPath: "Manager sidebar > Happy Hour",
        href: "/manager/happy-hour",
        surface: "manager",
      },
      {
        icon: Megaphone,
        title: "Promotions",
        what: "Targeted offers — new guest discount, birthday package, event-linked promo codes.",
        why: "Promotions drive traffic on quiet nights. Each promo tracks redemption so you know what works.",
        tryPath: "Manager sidebar > Promotions",
        href: "/manager/promotions",
        surface: "manager",
      },
      {
        icon: ClipboardList,
        title: "Inventory",
        what: "Bottle ledger with movement history, bulk restock, automatic 86-board for sold-out items.",
        why: "Running out of a popular vodka on a Saturday night costs thousands. The 86-board updates as bottles sell.",
        tryPath: "Manager sidebar > Inventory",
        href: "/manager/inventory",
        surface: "manager",
      },
      {
        icon: ShoppingCart,
        title: "Purchasing",
        what: "Purchase order lifecycle — suggested order from par levels, submit to supplier, receive and reconcile.",
        why: "Stock below-par alerts prevent 86s. POs track what was ordered, received, and paid — one audit trail.",
        tryPath: "Manager sidebar > Purchasing",
        href: "/manager/purchasing",
        surface: "manager",
      },
      {
        icon: ClipboardCheck,
        title: "Stocktake & variance",
        what: "Count sheets by zone, commit to ledger, review dollar variance and shrinkage reports.",
        why: "Bottles walk. Monthly stocktakes catch shrinkage — the variance report shows exactly what's missing and its retail value.",
        tryPath: "Manager sidebar > Inventory (Stocktake tab)",
        href: "/manager/inventory",
        surface: "manager",
      },
      {
        icon: Users,
        title: "Guests & CRM",
        what: "Guest profiles with VIP tiers, visit history, lifetime spend, bans, dedupe and merge tool.",
        why: "A guest who spends $2,000 every Saturday is a VIP. The CRM tracks that — and flags banned patrons at the door.",
        tryPath: "Manager sidebar > Guests",
        href: "/manager/guests",
        surface: "manager",
      },
      {
        icon: CalendarDays,
        title: "Reservations",
        what: "Booking board with table assignments, guestlist management, no-show tracking, promoter attribution.",
        why: "Reservations fill tables before doors open. No-show tracking and deposit forfeiture protect revenue.",
        tryPath: "Manager sidebar > Reservations",
        href: "/manager/reservations",
        surface: "manager",
      },
      {
        icon: PartyPopper,
        title: "Events",
        what: "Event calendar with guestlists, promoter attribution, ticket tiers, and night-specific config.",
        why: "A DJ night doubles revenue. Events carry their own guestlist, pricing, and floor configuration.",
        tryPath: "Manager sidebar > Events",
        href: "/manager/events",
        surface: "manager",
      },
      {
        icon: AlertTriangle,
        title: "Incidents",
        what: "Structured incident reports — ejection, refusal, medical, altercation — with severity, police flags, and resolution tracking.",
        why: "Documentation protects the venue. An incident with a police report needs a different workflow than a minor refusal.",
        tryPath: "Manager sidebar > Incidents",
        href: "/manager/incidents",
        surface: "manager",
      },
      {
        icon: Users,
        title: "Staff & scheduling",
        what: "Roster, week generation from templates, clock-in/out ledger, overtime flags, certifications.",
        why: "A Saturday shift needs 3 runners, 2 bartenders, 1 host, and security. The template fills the week; the ledger tracks reality.",
        tryPath: "Manager sidebar > Staff",
        href: "/manager/staff",
        surface: "manager",
      },
      {
        icon: Calculator,
        title: "Tips",
        what: "Hours-weighted tip pool distribution — computed per shift, closed, audited.",
        why: "Tip distribution is the most sensitive math in the venue. Hours-weighting means the opener and closer both get a fair share.",
        tryPath: "Manager sidebar > Tips",
        href: "/manager/tips",
        surface: "manager",
      },
      {
        icon: Banknote,
        title: "Commission",
        what: "Promoter and staff commission tracking — percentage of referred sales, paid out per period.",
        why: "Promoters fill guestlists on commission. Track what each promoter brought in and what they're owed.",
        tryPath: "Manager sidebar > Commission",
        href: "/manager/commission",
        surface: "manager",
      },
      {
        icon: CreditCard,
        title: "Cash-out",
        what: "Shift reconciliation by settlement method — cash, card, comp, void — with venue-wide audit trail.",
        why: "Every dollar at close needs a home. Cash-out reconciles what was taken in against what was recorded.",
        tryPath: "Manager sidebar > Cash-out",
        href: "/manager/cashout",
        surface: "manager",
      },
      {
        icon: BarChart3,
        title: "Analytics",
        what: "Sales, staff performance, inventory turns, session metrics, reservation yield — any date range.",
        why: "Revenue per square foot, pour cost percentage, server sales ranking — the numbers that run the business.",
        tryPath: "Manager sidebar > Analytics",
        href: "/manager/analytics",
        surface: "manager",
      },
      {
        icon: FileText,
        title: "Reports",
        what: "Compose metric blocks, export CSVs, schedule recurring report runs.",
        why: "Ownership wants a weekly P&L. The report engine builds it once and emails it every Monday.",
        tryPath: "Manager sidebar > Reports",
        href: "/manager/reports",
        surface: "manager",
      },
      {
        icon: ListChecks,
        title: "Audit trail",
        what: "Every state change logged — who did what, when, from which IP — filterable by entity and action.",
        why: "When money moves, the audit trail answers who authorized it. Immutable, exportable, subpoena-ready.",
        tryPath: "Manager sidebar > Audit",
        href: "/manager/audit",
        surface: "manager",
      },
      {
        icon: Cog,
        title: "Automations",
        what: "Rule engine — when condition then action — for SLA escalations, auto-86, capacity alerts.",
        why: "Don't watch Pulse all night. Automations escalate overdue orders and flag capacity thresholds automatically.",
        tryPath: "Manager sidebar > Automations",
        href: "/manager/automations",
        surface: "manager",
      },
      {
        icon: MessageSquare,
        title: "Team chat",
        what: "Floor, bar, and security channels — live crew communication alongside Pulse.",
        why: "The floor manager needs to reach a runner without leaving the desk. Chat channels mirror the venue's org.",
        tryPath: "Manager sidebar > Chat",
        href: "/manager/chat",
        surface: "manager",
      },
      {
        icon: Cog,
        title: "Settings",
        what: "Stacked fees and taxes, SLA tuning, tip presets, capacity limits, venue hours.",
        why: "Every venue runs different economics. Fee stacks, tax rates, and SLA windows are per-venue configuration.",
        tryPath: "Manager sidebar > Settings",
        href: "/manager/settings",
        surface: "manager",
      },
      {
        icon: CreditCard,
        title: "Subscription",
        what: "Plan management, billing history, usage meters, payment method.",
        why: "NightLifeNext is SaaS. The venue's plan determines feature access, staff seats, and table count.",
        tryPath: "Manager sidebar > Subscription",
        href: "/manager/subscription",
        surface: "manager",
      },
      {
        icon: Sparkles,
        title: "Onboarding",
        what: "Setup wizard — venue details, zones, tables, menu import, staff roster, fee configuration.",
        why: "A new venue opens in hours, not weeks. The wizard pre-fills sensible defaults and lets you skip anything.",
        tryPath: "Manager sidebar > Settings > Re-run onboarding",
        href: "/manager/onboarding",
        surface: "manager",
      },
    ],
  },
  // ── Staff ─────────────────────────────────────────────────────────
  {
    id: "staff",
    label: "Staff",
    icon: Smartphone,
    intro:
      "Mobile-first floor crew app — bottom tab bar, large touch targets, broadcast banners. Built like a phone app because it is one.",
    features: [
      {
        icon: Bell,
        title: "Home — queues, clock & 86-board",
        what: "Live queue counts for orders and help, one-tap clock-in/break/out, tonight's sold-out board.",
        why: "Staff open one screen at shift start. Everything they need to know — what's waiting, what's sold out — is right there.",
        tryPath: "Staff bottom bar > Home",
        href: "/staff",
        surface: "staff",
      },
      {
        icon: Receipt,
        title: "Order feed",
        what: "Claim an order, walk it pending to delivered — no double-assignment, clear ownership.",
        why: "Runners deliver bottles. Claim prevents two runners grabbing the same order; the guest sees live step tracking.",
        tryPath: "Staff bottom bar > Orders",
        href: "/staff/orders",
        surface: "staff",
      },
      {
        icon: DoorOpen,
        title: "Door — occupancy & admissions",
        what: "Live +1/−1 occupancy counter, party-size stepper, ID check, automatic ban alert.",
        why: "Capacity limits are fire code. The door controller admits guests, checks bans, and keeps the count legal.",
        tryPath: "Staff bottom bar > Door",
        href: "/staff/door",
        surface: "staff",
      },
      {
        icon: UserCheck,
        title: "Approvals",
        what: "Approve QR join requests, review guest profiles and visit history before seating.",
        why: "A host approves every table join. The approval screen shows who's asking and whether they've been here before.",
        tryPath: "Staff bottom bar > Approvals",
        href: "/staff/approvals",
        surface: "staff",
      },
      {
        icon: Headset,
        title: "Help queue",
        what: "Triaged requests — ice, cleanup, bill, security — claimed and resolved by the right role.",
        why: "A guest needs ice, a table needs bussing, a bottle needs presenting. Help routes each request to the right person.",
        tryPath: "Staff bottom bar > Help",
        href: "/staff/help",
        surface: "staff",
      },
      {
        icon: AlertTriangle,
        title: "Incidents",
        what: "Report ejections, medical, altercations — structured form with severity, description, and police flag.",
        why: "Security needs to log an ejection in 30 seconds. The structured form captures what happened before the night moves on.",
        tryPath: "Staff bottom bar > Incidents",
        href: "/staff/incidents",
        surface: "staff",
      },
      {
        icon: MessageSquare,
        title: "Team chat",
        what: "Floor, bar, and security channels — the same chat the manager sees, role-scoped.",
        why: "The bartender needs to tell the floor manager a bottle is 86'd. Chat is faster than walking across a loud club.",
        tryPath: "Staff bottom bar > Chat",
        href: "/staff/chat",
        surface: "staff",
      },
      {
        icon: CalendarDays,
        title: "Schedule",
        what: "This week's shifts — your days, your hours, your role per shift.",
        why: "Staff check when they're working next. The schedule view is personal — your shifts only.",
        tryPath: "Staff bottom bar > Schedule",
        href: "/staff/schedule",
        surface: "staff",
      },
      {
        icon: Calculator,
        title: "Tips",
        what: "Personal tip breakdown — what you earned tonight, how the pool distributed.",
        why: "Every staff member sees their own tip share. Transparent distribution builds trust.",
        tryPath: "Staff bottom bar > Tips",
        href: "/staff/tips",
        surface: "staff",
      },
      {
        icon: PartyPopper,
        title: "Events",
        what: "Tonight's event — who's on the guestlist, what's different about the floor.",
        why: "Staff need to know when a private event changes the usual table layout or pricing.",
        tryPath: "Staff bottom bar > Events",
        href: "/staff/events",
        surface: "staff",
      },
      {
        icon: CalendarDays,
        title: "Reservations",
        what: "Tonight's bookings — who's coming, which table, what time, any special requests.",
        why: "Security checks reservations at the door. Name, party size, table, and VIP notes in one list.",
        tryPath: "Staff bottom bar > Reservations",
        href: "/staff/reservations",
        surface: "staff",
      },
      {
        icon: Bell,
        title: "Notifications",
        what: "Broadcast banner history — manager alerts, last call, emergency notices.",
        why: "Missed a broadcast during the rush? Notifications keeps the log so nothing falls through.",
        tryPath: "Staff bottom bar > Notifications",
        href: "/staff/notifications",
        surface: "staff",
      },
    ],
  },
  // ── Guest ─────────────────────────────────────────────────────────
  {
    id: "guest",
    label: "Guest",
    icon: QrCode,
    intro:
      "What the table sees after scanning the QR — no app, no signup, no account. Just a first name and you're ordering.",
    features: [
      {
        icon: Martini,
        title: "Menu & ordering",
        what: "Bottles, curated packages, modifiers — browse by category, add to cart, fees itemize live.",
        why: "The menu IS the revenue engine. Bottle packages with sparkler presentations turn a $200 bottle into an $800 experience.",
        tryPath: "Scan demo table > Menu tab",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: ShoppingCart,
        title: "Cart",
        what: "Line items with modifiers, stacked fees, live total — review before placing the order.",
        why: "Fees (service charge, bottle fee, tax) are transparent before ordering. No surprises at close.",
        tryPath: "Scan demo table > Cart tab",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Receipt,
        title: "Orders",
        what: "Order history with live step tracking and delivery ETA per item.",
        why: "Guests watch their bottle move from placed to preparing to delivered. The ETA sets expectations.",
        tryPath: "Scan demo table > Orders tab",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Headset,
        title: "Help",
        what: "Request ice, cleanup, bill, or a server — triaged to the right staff role.",
        why: "No one wants to flag down a runner in a packed club. Help requests go direct to the right person.",
        tryPath: "Scan demo table > Help tab",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Gift,
        title: "Send a bottle",
        what: "Send a bottle to another table — anonymous or signed.",
        why: "Buying a bottle for another table is a nightclub tradition. The gift flow handles it without interrupting either table's tab.",
        tryPath: "Scan demo table > Gift tab",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Receipt,
        title: "Receipt & tab close",
        what: "Full-night receipt, minimum-spend progress ring, split payment options.",
        why: "Closing out should take seconds. The receipt shows everything — orders, fees, payments — one scroll.",
        tryPath: "Scan demo table > Receipt tab",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: Clock,
        title: "Waiting / host approval",
        what: "Post-join screen while the host reviews and approves the table join request.",
        why: "Every QR join is gated by host approval. The waiting screen shows status — the guest isn't left wondering.",
        tryPath: "Scan demo table > join > waiting screen",
        href: "/g/demo-table",
        surface: "guest",
      },
      {
        icon: KeyRound,
        title: "Reservation PIN gate",
        what: "Tables with active confirmed reservations require a 6-digit PIN to access QR ordering.",
        why: "A reserved table is private until the booker arrives. The PIN keeps someone else from claiming it.",
        tryPath: "Scan demo table > PIN prompt (on reserved tables)",
        href: "/g/demo-table",
        surface: "guest",
      },
    ],
  },
  // ── Public ────────────────────────────────────────────────────────
  {
    id: "public",
    label: "Public",
    icon: Globe,
    intro:
      "Customer-facing surfaces outside the app — public event pages and reservation pages per venue.",
    features: [
      {
        icon: Globe,
        title: "Public venue page",
        what: "Customer-facing venue landing — hours, location, upcoming events, reservation link.",
        why: "Every venue gets a public page at /e/venueslug. Guests discover events and book tables there.",
        tryPath: "Visit /e/velvet-montreal",
        href: "/e/velvet-montreal",
        surface: "public",
      },
      {
        icon: CalendarDays,
        title: "Public reservations",
        what: "Guest-facing reservation flow — pick date, party size, table, submit request.",
        why: "Guests book tables without calling the venue. The reservation lands in the manager's booking board.",
        tryPath: "Visit /r/velvet-montreal",
        href: "/r/velvet-montreal",
        surface: "public",
      },
    ],
  },
  // ── How the demo works ────────────────────────────────────────────
  {
    id: "how-it-works",
    label: "How the demo works",
    icon: Search,
    intro:
      "The sandbox rules — ten seconds to read, then go play. Every visitor gets an isolated, self-resetting instance.",
    features: [],
  },
];
