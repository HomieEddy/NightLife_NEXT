"use client";

import { useRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

/** The night runs 22:00 → 03:00; scroll progress scrubs the clock across it. */
const NIGHT_START = 22 * 60;
const NIGHT_LENGTH = 5 * 60;

function formatClock(totalMinutes: number) {
  const m = Math.round(totalMinutes) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ---------- Vignettes: small mocked slices of the real product ---------- */

function GuestPhoneVignette() {
  const items = [
    { name: "Moët & Chandon Impérial", price: "$180" },
    { name: "Grey Goose 1L + mixers", price: "$320" },
    { name: "Ice refill", price: "$0" },
  ];
  return (
    <div className="mx-auto w-[280px] rounded-[2.25rem] border bg-card p-2.5 shadow-2xl">
      <div className="rounded-[1.75rem] bg-background px-4 pb-4 pt-5">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Booth 7</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#22d3ee]" />
            Velvet Room
          </span>
        </div>
        <p className="text-display mt-4 text-lg">Bottles</p>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
            >
              <div>
                <p className="text-xs font-medium leading-tight">{item.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.price}</p>
              </div>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-semibold text-gold-deep dark:text-gold">
                +
              </span>
            </li>
          ))}
        </ul>
        <div className="foil glow-gold mt-4 flex items-center justify-between rounded-full px-4 py-3 text-sm font-semibold">
          <span>View order</span>
          <span className="font-mono">$500</span>
        </div>
      </div>
    </div>
  );
}

function ApprovalVignette() {
  return (
    <div className="relative mx-auto max-w-sm pt-8">
      <div className="absolute left-8 right-2 top-0 flex rotate-2 items-center gap-2 rounded-2xl border bg-card/70 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <Check className="size-3.5 text-[#a855f7]" />
        Booth 5 · approved 23:12
      </div>
      <div className="relative rounded-2xl border border-[#a855f7]/40 bg-card p-5 shadow-xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Approval request · 23:31
        </p>
        <p className="mt-2 text-lg font-semibold">Booth 12 wants to order</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Party of 8 · hosted by Maya · min. spend $1,500
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <span className="foil rounded-xl py-2.5 text-sm font-semibold">Approve</span>
          <span className="rounded-xl border py-2.5 text-sm font-medium">Hold</span>
        </div>
      </div>
    </div>
  );
}

const FEED = [
  { t: "00:41", zone: "VIP", color: "#a855f7", text: "Booth 7 — 2× Dom Pérignon → Alex" },
  { t: "00:42", zone: "BAR", color: "#22d3ee", text: "Ticket #214 ready for pickup" },
  { t: "00:44", zone: "FLOOR", color: "#d946ef", text: "Table 3 asked for ice → Sam" },
  { t: "00:45", zone: "DOOR", color: "#f59e0b", text: "Security ping, section B — resolved" },
];

function LiveFeedVignette() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-[#d946ef]" />
        Live feed · peak hour
      </p>
      <ul className="mt-4 space-y-3 font-mono text-xs">
        {FEED.map((row) => (
          <li key={row.t} className="flex items-start gap-3">
            <span className="text-muted-foreground">{row.t}</span>
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] tracking-wider"
              style={{ borderColor: `${row.color}66` }}
            >
              <span className="size-1.5 rounded-full" style={{ background: row.color }} />
              {row.zone}
            </span>
            <span className="leading-snug text-foreground/85">{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BARS = [22, 34, 48, 62, 88, 100, 74, 41, 18];

function ReportVignette() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Saturday · closed 03:04
      </p>
      <p className="text-display text-gradient-gold mt-3 text-4xl tabular-nums">$18,240</p>
      <p className="mt-1 text-sm text-muted-foreground">214 orders · 41 bottles · 9 comps</p>
      <div className="mt-5 flex h-20 items-end gap-1">
        {BARS.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${h}%`,
              background:
                h === 100 ? "var(--gold)" : "oklch(from var(--gold) l c h / 35%)",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>22:00</span>
        <span>00:30</span>
        <span>03:00</span>
      </div>
      <p className="mt-4 border-t pt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Top seller — Dom Pérignon ×11
      </p>
    </div>
  );
}

/* ---------- Timeline ---------- */

type Phase = {
  time: string;
  tag: string;
  accent: string;
  title: string;
  body: string;
  vignette: ReactNode;
};

const PHASES: Phase[] = [
  {
    time: "22:00",
    tag: "Doors",
    accent: "#22d3ee",
    title: "Doors open. Phones out.",
    body: "Guests scan the code on their table and order from the booth — no app to download, no line at the bar. Your menu goes live the second you open.",
    vignette: <GuestPhoneVignette />,
  },
  {
    time: "23:30",
    tag: "VIP arrives",
    accent: "#a855f7",
    title: "VIP holds the line.",
    body: "Bottle service stays controlled: hosts approve a table before it can order, so the big spenders get the attention they're paying for.",
    vignette: <ApprovalVignette />,
  },
  {
    time: "00:45",
    tag: "Peak hour",
    accent: "#d946ef",
    title: "Peak hour, zero radio static.",
    body: "Every order routes by zone to the right runner. Ice refills, cleanup and security requests reach staff phones the moment a guest raises a hand.",
    vignette: <LiveFeedVignette />,
  },
  {
    time: "03:00",
    tag: "Last call",
    accent: "#f59e0b",
    title: "Last call tells the truth.",
    body: "Revenue by hour, zone and bottle — see what tonight actually did before the lights come up, not Monday afternoon.",
    vignette: <ReportVignette />,
  },
];

export function NightTimeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top 55%",
        end: "bottom 80%",
        onUpdate: (self) => {
          const total = NIGHT_START + self.progress * NIGHT_LENGTH;
          if (clockRef.current) clockRef.current.textContent = formatClock(total);
          if (dayRef.current) dayRef.current.textContent = total >= 1440 ? "SUN" : "SAT";
        },
      });

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>(".phase").forEach((phase) => {
          gsap.from(phase.querySelectorAll(".phase-reveal"), {
            autoAlpha: 0,
            y: 36,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.1,
            scrollTrigger: { trigger: phase, start: "top 78%", once: true },
          });
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <section className="relative border-t border-border/60">
      <div
        ref={rootRef}
        className="mx-auto max-w-6xl px-4 py-24 sm:py-32 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20"
      >
        {/* Sticky clock rail — the scroll scrubs one Saturday night. */}
        <div className="mb-16 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <p className="max-w-[220px] font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              One Saturday, start to close
            </p>
            <p className="mt-4 flex items-baseline gap-3">
              <span ref={dayRef} className="font-mono text-sm text-muted-foreground">
                SAT
              </span>
              <span
                ref={clockRef}
                className="text-gradient-gold font-mono text-5xl font-bold tabular-nums tracking-tight"
              >
                22:00
              </span>
            </p>
            <div className="mt-8 hidden h-40 w-px bg-gradient-to-b from-gold/50 to-transparent lg:block" />
          </div>
        </div>

        <div className="space-y-24 lg:space-y-36">
          {PHASES.map((phase, i) => (
            <article
              key={phase.time}
              className="phase grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
            >
              <div className={cn(i % 2 === 1 && "lg:order-2")}>
                <p className="phase-reveal flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.25em]">
                  <span className="size-2 rounded-full" style={{ background: phase.accent }} />
                  <span className="font-semibold">{phase.time}</span>
                  <span className="text-muted-foreground">— {phase.tag}</span>
                </p>
                <h3 className="phase-reveal mt-4 font-display text-4xl uppercase leading-[0.95] tracking-[0.01em] sm:text-5xl">
                  {phase.title}
                </h3>
                <p className="phase-reveal mt-4 max-w-md text-muted-foreground">{phase.body}</p>
              </div>
              <div className={cn("phase-reveal", i % 2 === 1 && "lg:order-1")}>
                {phase.vignette}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
