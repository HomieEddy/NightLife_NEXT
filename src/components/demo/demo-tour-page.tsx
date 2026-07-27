import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  Gift,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Map,
  Martini,
  Megaphone,
  MessageSquare,
  PartyPopper,
  QrCode,
  Radio,
  Receipt,
  RefreshCcw,
  Search,
  Shield,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Timer,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/fx/reveal";
import { ClubLights } from "@/components/fx/club-lights";
import { DemoQr } from "@/components/demo/demo-qr";

interface DemoFeature {
  icon: LucideIcon;
  title: string;
  /** One scannable line — the row itself links into the demo. */
  guide: string;
  href: string;
}

interface DemoSegment {
  id: string;
  icon: LucideIcon;
  name: string;
  tagline: string;
  navGuide: string;
  accent: string; // border/text accent classes for the segment header
  cta: { href: string; label: string };
  features: DemoFeature[];
}

const SEGMENTS: DemoSegment[] = [
  {
    id: "manager",
    icon: LayoutDashboard,
    name: "Manager panel",
    tagline: "The venue's control room — desktop-first, sidebar navigation.",
    navGuide:
      "Everything lives in the left sidebar. First visit opens a prefilled setup wizard — skip it or finish it, re-run from Settings.",
    accent: "border-violet-500/40 text-violet-500 dark:text-violet-400",
    cta: { href: "/manager", label: "Open the manager panel" },
    features: [
      {
        icon: Radio,
        title: "Pulse — live attention feed",
        guide: "SLA-aged attention queue, staff broadcasts, one-tap last call.",
        href: "/manager/pulse",
      },
      {
        icon: Receipt,
        title: "Orders feed & guest sessions",
        guide: "Every order, filterable by zone/table — session tabs with transfers, merges and tab adjustments.",
        href: "/manager/orders",
      },
      {
        icon: DoorOpen,
        title: "Door & occupancy",
        guide: "Live occupancy counter +1/−1, search reservations & guestlist, automatic ban check, coat check.",
        href: "/manager/guests",
      },
      {
        icon: Users,
        title: "Guest profiles & CRM",
        guide: "VIP tiers, visit history, lifetime spend, bans. Profile dedupe & merge tool.",
        href: "/manager/guests",
      },
      {
        icon: AlertTriangle,
        title: "Incidents log",
        guide: "Ejection, refusal, medical, altercation — structured reports with severity & police flags.",
        href: "/manager/incidents",
      },
      {
        icon: Map,
        title: "Interactive floor map",
        guide: "Tap any table for live status; drag-to-edit your real floor.",
        href: "/manager/floor-map",
      },
      {
        icon: BarChart3,
        title: "Historical analytics",
        guide: "Sales, staff, inventory, sessions, reservations, promotions — any date range.",
        href: "/manager/analytics",
      },
      {
        icon: FileText,
        title: "Report engine",
        guide: "Compose metric blocks, export CSVs, schedule recurring runs.",
        href: "/manager/reports",
      },
      {
        icon: Martini,
        title: "Menu, packages & happy hour",
        guide: "Bottles, curated packages (Table Starter → Legacy), time-boxed discount rules.",
        href: "/manager/menu",
      },
      {
        icon: ClipboardList,
        title: "Inventory & bulk restock",
        guide: "Movement ledger, one-pass restock, automatic 86-board.",
        href: "/manager/inventory",
      },
      {
        icon: ShoppingCart,
        title: "Purchasing & suppliers",
        guide: "PO lifecycle: suggested order → submit → receive. Stock below-par alerts.",
        href: "/manager/purchasing",
      },
      {
        icon: ClipboardCheck,
        title: "Stocktake & variance",
        guide: "Count sheets → commit → $ variance. Shrinkage report.",
        href: "/manager/inventory",
      },
      {
        icon: CalendarDays,
        title: "Reservations & events",
        guide: "Booking board, no-show tracking, event guestlists, promoter attribution.",
        href: "/manager/reservations",
      },
      {
        icon: Calculator,
        title: "Tips & commissions",
        guide: "Hours-weighted tip pool distribution — computed, closed, audited.",
        href: "/manager/tips",
      },
      {
        icon: Users,
        title: "Staff, scheduling & time clock",
        guide: "Roster, week generation from templates, clock-in/out ledger, overtime flags.",
        href: "/manager/staff",
      },
      {
        icon: ListChecks,
        title: "Cash-out & audit trail",
        guide: "Shift reconciliation by settlement method, venue-wide audit log.",
        href: "/manager/audit",
      },
      {
        icon: QrCode,
        title: "Zones, tables & QR codes",
        guide: "Per-table QR codes — copy, download, print the sheet.",
        href: "/manager/qr",
      },
      {
        icon: MessageSquare,
        title: "Team chat",
        guide: "Floor, bar and security channels — live crew communication.",
        href: "/manager/chat",
      },
      {
        icon: CreditCard,
        title: "Settings & subscription",
        guide: "Stacked fees and taxes, SLA tuning, tip presets, capacity limits.",
        href: "/manager/settings",
      },
    ],
  },
  {
    id: "staff",
    icon: Smartphone,
    name: "Staff panel",
    tagline: "Mobile-first for the floor crew — big targets, bottom navigation.",
    navGuide:
      "Built like a phone app — everything in the bottom bar; manager broadcasts land as banners you can't miss mid-shift.",
    accent: "border-fuchsia-500/40 text-fuchsia-500 dark:text-fuchsia-400",
    cta: { href: "/staff", label: "Open the staff panel" },
    features: [
      {
        icon: Bell,
        title: "Home: queues, clock & 86-board",
        guide: "Live queue counts, one-tap clock-in/break/out, tonight's sold-out board.",
        href: "/staff",
      },
      {
        icon: Receipt,
        title: "Order feed with claim & release",
        guide: "Claim an order, walk it pending → delivered — no doubles.",
        href: "/staff/orders",
      },
      {
        icon: DoorOpen,
        title: "Door: occupancy & admissions",
        guide: "+1/−1 counter, party-size stepper, ID check, ban alert.",
        href: "/staff/door",
      },
      {
        icon: AlertTriangle,
        title: "Incident reporting",
        guide: "Report ejections, medical, altercations — structured form with severity.",
        href: "/staff/incidents",
      },
      {
        icon: UserCheck,
        title: "Guest approvals & tab closures",
        guide: "Approve QR join requests, see guest profile & visit history.",
        href: "/staff/approvals",
      },
      {
        icon: PartyPopper,
        title: "Show floor lock",
        guide: "One sparkler parade walks the floor at a time.",
        href: "/staff/orders",
      },
      {
        icon: MessageSquare,
        title: "Help queue & team chat",
        guide: "Ice, cleanup, bill, security — triaged; crew channels beside it.",
        href: "/staff/help",
      },
    ],
  },
  {
    id: "guest",
    icon: QrCode,
    name: "Guest experience",
    tagline: "What the table sees after scanning the QR — no app, no signup.",
    navGuide:
      "Scan, give a first name, wave yourself through with “Simulate host approval” — then order from the bottom bar.",
    accent: "border-cyan-500/40 text-cyan-500 dark:text-cyan-400",
    cta: { href: "/g/demo-table", label: "Scan the demo table" },
    features: [
      {
        icon: Martini,
        title: "Menu, packages & ordering",
        guide: "Bottles, packages, modifiers — fees itemize live in the cart.",
        href: "/g/demo-table",
      },
      {
        icon: Timer,
        title: "Live order tracking & ETA",
        guide: "Step tracker with a live delivery estimate.",
        href: "/g/demo-table",
      },
      {
        icon: Shield,
        title: "Responsible service",
        guide: "Drink counter visible to staff — service can be refused with an incident log.",
        href: "/g/demo-table",
      },
      {
        icon: Gift,
        title: "Send a bottle to another table",
        guide: "Anonymous gift bottle. Very nightclub.",
        href: "/g/demo-table",
      },
      {
        icon: Wallet,
        title: "Tab closure, receipt & minimum-spend",
        guide: "Close out, minimum-spend progress ring, full-night receipt, split it any way.",
        href: "/g/demo-table",
      },
      {
        icon: KeyRound,
        title: "Reservation PIN gate",
        guide: "Confirmed reservations require a 6-digit PIN to access the table's QR ordering.",
        href: "/g/demo-table",
      },
    ],
  },
];

const HOUSE_RULES: {
  icon: LucideIcon;
  title: string;
  line: string;
  href?: string;
  linkLabel?: string;
}[] = [
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
    line: "Reload resets the night — use in-app links to travel between surfaces.",
  },
  {
    icon: Sparkles,
    title: "Play the other side",
    line: "'Simulate' buttons stand in for host approval and kitchen — real flows, mock actions.",
  },
  {
    icon: Search,
    title: "Ctrl+K for command palette",
    line: "Search orders, tables, staff, menu, reservations — or jump directly to any page.",
  },
];

const WALKTHROUGH = [
  {
    step: "Order as a guest",
    detail: "Scan the demo table, join, approve yourself, browse packages, and send a bottle order to the floor.",
    href: "/g/demo-table",
    linkLabel: "Guest QR",
  },
  {
    step: "Work it as staff",
    detail: "Open the order feed, claim the order you just placed, clock in, and walk the order to delivered.",
    href: "/staff/orders",
    linkLabel: "Staff orders",
  },
  {
    step: "Work the door",
    detail: "Check the live occupancy counter, search for a reservation, admit a walk-in with ID check.",
    href: "/staff/door",
    linkLabel: "Staff door",
  },
  {
    step: "Watch the pulse as manager",
    detail: "Check Pulse for anything running late — overdue orders, open incidents, capacity warnings.",
    href: "/manager/pulse",
    linkLabel: "Pulse",
  },
  {
    step: "Manage the money",
    detail: "Comp a bottle, check pour cost, run a stocktake, compute tonight's tip distribution.",
    href: "/manager/cashout",
    linkLabel: "Cash-out",
  },
];

export default function DemoTourPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* ---------- Hero: poster type over the ambient light field ---------- */}
      <section className="grain-overlay relative -mx-4 overflow-hidden px-4 py-20 text-center sm:py-28">
        <ClubLights density={320} className="opacity-70" />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(640px 340px at 50% 0%, oklch(from var(--gold) l c h / 16%), transparent), radial-gradient(ellipse at bottom, var(--background) 25%, transparent 65%)",
          }}
        />
        <Reveal className="relative">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-gold/40 bg-background/50 text-gold-deep backdrop-blur dark:text-gold"
          >
            <Sparkles className="size-3" /> Fully interactive — mock data, real flows
          </Badge>
          <h1 className="text-display mx-auto max-w-4xl text-[clamp(2.75rem,8vw,6rem)]">
            Take the <span className="text-gradient-gold">live demo</span>{" "}
            <span className="text-outline">tour</span>
          </h1>
          <p className="text-voice mx-auto mt-5 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            NightLifeNext has three surfaces — one for the manager, one for the floor crew, and
            one for the guest at the table. This page walks you through each, with links straight
            into the demo.
          </p>
        </Reveal>

        {/* Segment quick-jump */}
        <Reveal
          delay={0.1}
          className="relative mt-9 flex flex-wrap items-center justify-center gap-2"
        >
          {SEGMENTS.map((segment) => (
            <a
              key={segment.id}
              href={`#${segment.id}`}
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-gold/60 hover:text-gold-deep dark:hover:text-gold"
            >
              <segment.icon className="size-3.5" />
              {segment.name}
            </a>
          ))}
          <a
            href="#walkthrough"
            className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold-deep transition-colors hover:bg-gold/20 dark:text-gold"
          >
            <Megaphone className="size-3.5" /> 5-minute walkthrough
          </a>
        </Reveal>
        <hr className="rule-gold absolute inset-x-8 bottom-0" aria-hidden="true" />
      </section>

      {/* ---------- House rules: one scannable concierge strip, not cards ---------- */}
      <section className="scroll-mt-20">
        <Reveal className="flex items-baseline justify-between gap-4">
          <h2 className="text-display text-xl sm:text-2xl">Before you dive in</h2>
          <p className="text-voice text-sm text-muted-foreground">
            The house rules — ten seconds, then go play.
          </p>
        </Reveal>
        <Reveal
          stagger={0.08}
          y={24}
          className="mt-6 grid overflow-hidden rounded-2xl border border-gold/25 bg-card/40 backdrop-blur sm:grid-cols-2 lg:grid-cols-4"
        >
          {HOUSE_RULES.map((rule) => (
            <div
              key={rule.title}
              className="border-gold/15 p-5 max-lg:[&:nth-child(n+2)]:border-t lg:[&:nth-child(n+2)]:border-l sm:max-lg:[&:nth-child(2)]:border-t-0 sm:max-lg:[&:nth-child(even)]:border-l"
            >
              <rule.icon className="size-4 text-gold-deep dark:text-gold" />
              <h3 className="mt-3 text-sm font-semibold">{rule.title}</h3>
              <p className="text-voice mt-1 text-sm text-muted-foreground">{rule.line}</p>
              {rule.href && (
                <Link
                  href={rule.href}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline dark:text-gold"
                >
                  {rule.linkLabel} <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
          ))}
        </Reveal>
      </section>

      {/* ---------- Role segments ---------- */}
      {SEGMENTS.map((segment) => (
        <section key={segment.id} id={segment.id} className="mt-20 scroll-mt-20">
          <Reveal>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-11 items-center justify-center rounded-xl border bg-card/60 ${segment.accent}`}
                  >
                    <segment.icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-display text-xl sm:text-2xl">{segment.name}</h2>
                    <p className="text-sm text-muted-foreground">{segment.tagline}</p>
                  </div>
                </div>
                <p className="text-voice mt-4 text-sm leading-relaxed text-muted-foreground">
                  {segment.navGuide}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {segment.id === "guest" && (
                  <DemoQr
                    path="/g/demo-table"
                    className="size-20 overflow-hidden rounded-lg border bg-white p-1 [&_svg]:size-full"
                  />
                )}
                <Button className="glow-gold" asChild>
                  <Link href={segment.cta.href}>
                    {segment.cta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>

          {/* Feature menu: every row is a live link into the demo. */}
          <Reveal stagger={0.05} y={20} className="mt-7 grid gap-x-14 lg:grid-cols-2">
            {segment.features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group flex items-center gap-3.5 border-b border-border/60 py-3.5 transition-colors hover:border-gold/60"
              >
                <feature.icon className="size-4 shrink-0 text-gold-deep dark:text-gold" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold transition-colors group-hover:text-gold-deep dark:group-hover:text-gold">
                    {feature.title}
                  </span>
                  <span className="text-voice block truncate text-sm text-muted-foreground">
                    {feature.guide}
                  </span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-gold-deep dark:group-hover:text-gold" />
              </Link>
            ))}
          </Reveal>
        </section>
      ))}

      {/* ---------- Suggested walkthrough ---------- */}
      <section id="walkthrough" className="mt-20 scroll-mt-20">
        <Reveal>
          <h2 className="text-display text-xl sm:text-2xl">The 5-minute walkthrough</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            The fastest way to feel the whole loop — one order travelling guest → staff → manager.
            Use in-app links between steps so the night doesn&apos;t reset.
          </p>
        </Reveal>
        <Reveal stagger={0.07} y={24} className="mt-6 space-y-3">
          {WALKTHROUGH.map((item, i) => (
            <Card key={item.step} className="bg-card/60 py-4 backdrop-blur">
              <CardContent className="flex flex-wrap items-center gap-4 px-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.step}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={item.href}>
                    {item.linkLabel} <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </Reveal>

        <Reveal className="mt-12 text-center" delay={0.1}>
          <p className="text-sm text-muted-foreground">
            Like what you see? Tell us about your venue.
          </p>
          <Button size="lg" variant="foil" className="mt-4 h-12 px-7 glow-gold" asChild>
            <Link href="/lead">
              Request a personalized demo <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </section>
    </div>
  );
}
