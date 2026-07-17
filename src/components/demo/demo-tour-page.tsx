import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Gift,
  KeyRound,
  LayoutDashboard,
  Map,
  Martini,
  Megaphone,
  MessageSquare,
  PartyPopper,
  QrCode,
  Radio,
  Receipt,
  RefreshCcw,
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

interface DemoFeature {
  icon: LucideIcon;
  title: string;
  guide: string;
  href: string;
  linkLabel: string;
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
      "Everything lives in the left sidebar (top tabs on mobile). Your first visit opens a prefilled onboarding wizard — finish it or hit \"Skip for now\" to land on the Dashboard. You can re-run it any time from Settings → Setup.",
    accent: "border-violet-500/40 text-violet-500 dark:text-violet-400",
    cta: { href: "/manager", label: "Open the manager panel" },
    features: [
      {
        icon: Radio,
        title: "Dashboard & live pulse",
        guide:
          "The Tonight tab is the calm overview; the Pulse tab is the nerve center — overdue orders and stale help requests age against your SLA thresholds, plus a staff broadcast composer and a one-tap last-call sequence that blocks new guest orders venue-wide.",
        href: "/manager",
        linkLabel: "Dashboard",
      },
      {
        icon: Map,
        title: "Interactive floor map",
        guide:
          "Tap a table for details, orders and status changes. \"Edit layout\" unlocks drag-to-position and canvas-shape presets so the map matches your real floor.",
        href: "/manager/floor-map",
        linkLabel: "Floor map",
      },
      {
        icon: Receipt,
        title: "Orders feed & sessions",
        guide:
          "Every order in the venue with search plus zone, table, staff and category filters. Flip to the Sessions view to see per-table tabs at a glance.",
        href: "/manager/orders",
        linkLabel: "Orders",
      },
      {
        icon: BarChart3,
        title: "Historical analytics",
        guide:
          "Sales, staff and inventory tabs over 7/30/90-day presets or a custom date range — every chart reacts to the range you pick.",
        href: "/manager/analytics",
        linkLabel: "Analytics",
      },
      {
        icon: FileText,
        title: "Report engine",
        guide:
          "Compose reports from metric blocks, run them on demand, download CSVs, or schedule recurring runs. Saved and scheduled reports collect in the table below the builder.",
        href: "/manager/reports",
        linkLabel: "Reports",
      },
      {
        icon: Martini,
        title: "Menu, packages & happy hour",
        guide:
          "Bottles with modifiers, curated packages with live availability quotes, and time-boxed happy-hour discount rules per category.",
        href: "/manager/menu",
        linkLabel: "Menu",
      },
      {
        icon: ClipboardList,
        title: "Inventory & bulk restock",
        guide:
          "Stock levels with an append-style movement log. Restock one bottle or hit \"Bulk restock\" to log a whole delivery in one pass — selling out feeds the staff 86-board automatically.",
        href: "/manager/inventory",
        linkLabel: "Inventory",
      },
      {
        icon: QrCode,
        title: "Zones, tables & QR codes",
        guide:
          "Full CRUD for zones and tables; each table gets a scannable QR you can copy, download as PNG, or print as a whole sheet.",
        href: "/manager/qr",
        linkLabel: "QR codes",
      },
      {
        icon: Users,
        title: "Staff, scheduling & accounts",
        guide:
          "Team roster with roles and zone assignments, a weekly night-first schedule, and account controls (invites, suspension, PIN resets).",
        href: "/manager/staff",
        linkLabel: "Staff",
      },
      {
        icon: CalendarDays,
        title: "Reservations, events & promos",
        guide:
          "A reservations board (confirm → seat → complete), events with guestlists, and promo codes with a built-in validator.",
        href: "/manager/reservations",
        linkLabel: "Reservations",
      },
      {
        icon: CreditCard,
        title: "Settings & subscription",
        guide:
          "Stack multiple service fees and taxes (flat or percentage — they flow straight into guest checkout), tune Pulse SLA thresholds, and manage the venue's SaaS plan.",
        href: "/manager/settings",
        linkLabel: "Settings",
      },
    ],
  },
  {
    id: "staff",
    icon: Smartphone,
    name: "Staff panel",
    tagline: "Mobile-first for the floor crew — big targets, bottom navigation.",
    navGuide:
      "Built like a phone app: Home, Orders, Approvals, Help and Chat live in the bottom bar. Manager broadcasts and last call appear as full-width banners above everything, impossible to miss mid-shift.",
    accent: "border-fuchsia-500/40 text-fuchsia-500 dark:text-fuchsia-400",
    cta: { href: "/staff", label: "Open the staff panel" },
    features: [
      {
        icon: Receipt,
        title: "Order feed with claim & release",
        guide:
          "Advance orders through pending → delivered. Tap \"Claim\" so two runners never work the same order; \"My zones\" scopes the feed to your assigned zones.",
        href: "/staff/orders",
        linkLabel: "Order feed",
      },
      {
        icon: PartyPopper,
        title: "Show floor lock",
        guide:
          "Orders with a presentation (sparkler parade, LED signs) get a \"Start show\" control on ready. Only one show can walk at a time — everyone else sees whose table has the floor.",
        href: "/staff/orders",
        linkLabel: "Try it on a ready order",
      },
      {
        icon: Bell,
        title: "Home: queues & the 86-board",
        guide:
          "Live counts for new orders, approvals and help requests — plus an \"86'd tonight\" board that updates the moment a bottle sells out or gets pulled.",
        href: "/staff",
        linkLabel: "Staff home",
      },
      {
        icon: UserCheck,
        title: "Guest approvals & tab closures",
        guide:
          "Approve or deny join requests when guests scan a table QR, and settle closure requests when a table wants to cash out.",
        href: "/staff/approvals",
        linkLabel: "Approvals",
      },
      {
        icon: MessageSquare,
        title: "Help queue & team chat",
        guide:
          "One-tap guest requests (ice, cleanup, bill, security) flow into a triage queue; floor, bar and security chat channels keep the crew in sync.",
        href: "/staff/help",
        linkLabel: "Help queue",
      },
    ],
  },
  {
    id: "guest",
    icon: QrCode,
    name: "Guest experience",
    tagline: "What the table sees after scanning the QR — no app, no signup.",
    navGuide:
      "Start at the demo table QR link, enter a first name and join. A host normally approves you — the waiting screen has a \"Simulate host approval\" button so you can wave yourself through. After that, Menu, Cart, Orders and Help sit in the bottom bar.",
    accent: "border-cyan-500/40 text-cyan-500 dark:text-cyan-400",
    cta: { href: "/g/demo-table", label: "Scan the demo table" },
    features: [
      {
        icon: Martini,
        title: "Menu, packages & ordering",
        guide:
          "Browse bottles and curated packages, pick modifiers and washers, tip, and place the order — fees and taxes itemize live in the cart exactly as the manager configured them.",
        href: "/g/demo-table",
        linkLabel: "Start ordering",
      },
      {
        icon: Timer,
        title: "Live order tracking & ETA",
        guide:
          "A step tracker follows your order from sent to delivered, with a live \"~N min\" delivery estimate. Use \"Simulate progress\" to fast-forward the kitchen.",
        href: "/g/demo-table",
        linkLabel: "Track an order",
      },
      {
        icon: Gift,
        title: "Send a bottle to another table",
        guide:
          "Pick a bottle, pick an occupied table, add an anonymous note — it lands on your tab and gets delivered to theirs. Very nightclub.",
        href: "/g/demo-table",
        linkLabel: "Send a gift",
      },
      {
        icon: Wallet,
        title: "Tab closure, receipt & bill splitting",
        guide:
          "Once everything's delivered, request to close the tab and get the full-night paper receipt — then split it evenly or by custom per-person amounts.",
        href: "/g/demo-table",
        linkLabel: "Close a tab",
      },
    ],
  },
];

const HOW_IT_WORKS = [
  {
    icon: KeyRound,
    title: "Sign in as anyone",
    body: "The login page has one-tap demo personas — Amara (manager) and Nina (staff runner). Any PIN works, and the manager, staff and guest areas stay open even without signing in.",
    href: "/login",
    linkLabel: "Go to login",
  },
  {
    icon: RefreshCcw,
    title: "Mock data, fresh every visit",
    body: "Everything runs on realistic in-memory data — no real backend yet. A full page reload resets the night, so navigate with in-app links to keep your changes alive.",
  },
  {
    icon: Sparkles,
    title: "Prototype fast-forwards",
    body: "Anywhere a real second party would act, a labeled control lets you play their part: \"Simulate host approval\" on the guest waiting screen, \"Simulate progress\" on order tracking.",
  },
  {
    icon: Clock,
    title: "First-run onboarding",
    body: "Your first trip into the manager panel opens a guided, prefilled setup wizard — the same one a freshly provisioned venue would see. Skip it or finish it; restart from Settings.",
    href: "/manager",
    linkLabel: "Trigger it",
  },
];

const WALKTHROUGH = [
  {
    step: "Order as a guest",
    detail: "Scan the demo table, join, approve yourself, and send a bottle order to the floor.",
    href: "/g/demo-table",
    linkLabel: "Guest QR",
  },
  {
    step: "Work it as staff",
    detail: "Open the order feed, claim the order you just placed, and walk it to delivered — start the show if it has a sparkler parade.",
    href: "/staff/orders",
    linkLabel: "Staff orders",
  },
  {
    step: "Watch the floor as the manager",
    detail: "Check the Pulse tab for anything running late, then open the floor map and tap the ordering table.",
    href: "/manager",
    linkLabel: "Manager dashboard",
  },
  {
    step: "Call last call",
    detail: "From Pulse, start last call — then hop back to the guest menu and watch ordering lock venue-wide.",
    href: "/manager",
    linkLabel: "Pulse tab",
  },
];

export default function DemoTourPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* ---------- Hero ---------- */}
      <section className="py-16 text-center sm:py-20">
        <Reveal>
          <Badge
            variant="outline"
            className="mb-5 gap-1.5 border-primary/40 bg-background/50 text-primary backdrop-blur"
          >
            <Sparkles className="size-3" /> Fully interactive — mock data, real flows
          </Badge>
          <h1 className="text-display mx-auto max-w-3xl text-3xl sm:text-5xl">
            Take the <span className="text-gradient-gold">live demo</span> tour
          </h1>
          <p className="text-voice mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            NightLifeNext has three surfaces — one for the manager, one for the floor crew, and
            one for the guest at the table. This page walks you through each, with links straight
            into the demo.
          </p>
        </Reveal>

        {/* Segment quick-jump */}
        <Reveal delay={0.1} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {SEGMENTS.map((segment) => (
            <a
              key={segment.id}
              href={`#${segment.id}`}
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <segment.icon className="size-3.5" />
              {segment.name}
            </a>
          ))}
          <a
            href="#walkthrough"
            className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Megaphone className="size-3.5" /> 5-minute walkthrough
          </a>
        </Reveal>
      </section>

      {/* ---------- How the demo works ---------- */}
      <section className="scroll-mt-20">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Before you dive in
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Four things that make the demo tick.
          </p>
        </Reveal>
        <Reveal stagger={0.08} y={28} className="mt-6 grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.title} className="bg-card/60 py-5 backdrop-blur">
              <CardContent className="px-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
                {item.href && (
                  <Link
                    href={item.href}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {item.linkLabel} <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </CardContent>
            </Card>
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
                    <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {segment.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">{segment.tagline}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Getting around: </span>
                  {segment.navGuide}
                </p>
              </div>
              <Button className="glow-primary" asChild>
                <Link href={segment.cta.href}>
                  {segment.cta.label} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal stagger={0.06} y={28} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {segment.features.map((feature) => (
              <Card
                key={feature.title}
                className="flex h-full flex-col border-border/60 bg-card/60 py-5 backdrop-blur transition-colors hover:border-primary/40"
              >
                <CardContent className="flex flex-1 flex-col px-5">
                  <div className="flex items-center gap-2.5">
                    <feature.icon className="size-4 shrink-0 text-primary" />
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                  </div>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{feature.guide}</p>
                  <Link
                    href={feature.href}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {feature.linkLabel} <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </Reveal>
        </section>
      ))}

      {/* ---------- Suggested walkthrough ---------- */}
      <section id="walkthrough" className="mt-20 scroll-mt-20">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            The 5-minute walkthrough
          </h2>
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
