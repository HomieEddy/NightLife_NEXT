"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronDown,
  MessageSquare,
  QrCode,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClubLights } from "@/components/fx/club-lights";
import { CountUp } from "@/components/fx/count-up";
import { Magnetic } from "@/components/fx/magnetic";
import { Reveal } from "@/components/fx/reveal";
import { TiltCard } from "@/components/fx/tilt-card";
import { gsap, useGSAP } from "@/lib/gsap";

const FEATURES = [
  {
    icon: QrCode,
    title: "QR table ordering",
    body: "Guests scan, browse and order from their booth. No app download, no queue at the bar.",
  },
  {
    icon: Zap,
    title: "Runner zone routing",
    body: "Orders route to the right runner by zone, so VIP bottles never wait behind bar tickets.",
  },
  {
    icon: Users,
    title: "Host approval flow",
    body: "Hosts approve tables before guests can order — keeping bottle-service control where it belongs.",
  },
  {
    icon: Bell,
    title: "One-tap help requests",
    body: "Ice refills, table cleanup, security — guests raise a hand digitally, staff see it instantly.",
  },
  {
    icon: BarChart3,
    title: "Live night analytics",
    body: "Revenue by hour, by zone, by bottle. Know what your Saturday actually looks like.",
  },
  {
    icon: MessageSquare,
    title: "Team chat",
    body: "Floor, bar and security channels keep the whole crew in sync without radios.",
  },
];

const STATS = [
  { value: 38, suffix: "%", label: "faster table service" },
  { value: 22, prefix: "+", suffix: "%", label: "avg. spend per table" },
  { value: 4, suffix: " min", label: "avg. bottle delivery" },
];

const PLANS = [
  { name: "Starter", price: "$149", tagline: "Single-room venues", highlight: false },
  { name: "Pro", price: "$349", tagline: "Multi-zone clubs", highlight: true },
  { name: "Enterprise", price: "Custom", tagline: "Groups & franchises", highlight: false },
];

const MARQUEE_VENUES = [
  "LUXE Noir",
  "Velvet Room",
  "Neon Garden",
  "Mirage Club",
  "Bassline Warehouse",
  "Sky Lounge 21",
  "Static Underground",
  "Club Onyx",
];

/** Words wrapped for the hero's masked slide-up reveal. */
function HeroWords({ text, wordClassName }: { text: string; wordClassName?: string }) {
  return (
    <span>
      {text.split(" ").map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
          {/* Gradient goes on each word: background-clip:text breaks on an
              ancestor when children get transformed during the reveal. */}
          <span
            className={`hero-word inline-block will-change-transform ${wordClassName ?? ""}`}
          >
            {word}
            {" "}
          </span>
        </span>
      ))}
    </span>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from(".hero-badge", { opacity: 0, y: 16, scale: 0.9, duration: 0.6 })
        .from(
          ".hero-word",
          { yPercent: 115, duration: 0.9, stagger: 0.055 },
          "-=0.3",
        )
        .from(".hero-sub", { opacity: 0, y: 20, duration: 0.7 }, "-=0.45")
        .from(".hero-cta", { opacity: 0, y: 18, duration: 0.6, stagger: 0.12 }, "-=0.4")
        .from(".hero-stat", { opacity: 0, y: 24, duration: 0.7, stagger: 0.1 }, "-=0.3")
        .from(".hero-scroll-cue", { opacity: 0, duration: 0.8 }, "-=0.2");
    },
    { scope: heroRef },
  );

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section
        ref={heroRef}
        className="relative flex min-h-[92dvh] flex-col justify-center overflow-hidden"
      >
        <ClubLights density={420} className="opacity-80" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 380px at 50% 10%, oklch(0.62 0.24 300 / 22%), transparent), radial-gradient(500px 320px at 85% 65%, oklch(0.7 0.2 340 / 14%), transparent), radial-gradient(ellipse at bottom, var(--background) 20%, transparent 60%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 text-center">
          <Badge
            variant="outline"
            className="hero-badge mb-6 gap-1.5 border-primary/40 bg-background/50 text-primary backdrop-blur"
          >
            <Sparkles className="size-3" /> Now in private beta
          </Badge>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <HeroWords text="The operating system for" />
            <br />
            <HeroWords text="unforgettable nights" wordClassName="text-gradient-brand" />
          </h1>

          <p className="hero-sub mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            QR ordering, bottle-service approvals, runner routing and live analytics — one
            platform built for nightclubs, not restaurants.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="hero-cta">
              <Magnetic>
                <Button size="lg" className="h-12 px-7 text-base glow-primary" asChild>
                  <Link href="/lead">
                    Request a demo <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </Magnetic>
            </div>
            <div className="hero-cta">
              <Magnetic strength={0.25}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 bg-background/40 px-7 text-base backdrop-blur"
                  asChild
                >
                  <Link href="/g/demo-table">
                    <Smartphone className="size-4" /> Try the guest experience
                  </Link>
                </Button>
              </Magnetic>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="hero-stat">
                <p className="text-3xl font-bold text-primary sm:text-4xl">
                  {stat.prefix}
                  <CountUp value={stat.value} duration={2} />
                  {stat.suffix}
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-scroll-cue pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <ChevronDown className="size-5 animate-bounce-soft text-muted-foreground" />
        </div>
      </section>

      {/* ---------- Marquee ---------- */}
      <section className="border-y bg-card/30 py-5 overflow-hidden">
        <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Powering the nights at
        </p>
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="animate-marquee flex shrink-0 items-center">
            {[...MARQUEE_VENUES, ...MARQUEE_VENUES].map((venue, i) => (
              <span
                key={i}
                className="mx-6 flex items-center gap-6 whitespace-nowrap text-lg font-semibold text-foreground/60"
              >
                {venue}
                <span className="size-1.5 rounded-full bg-primary/60" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <Reveal className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            Built for the way clubs <span className="text-gradient-brand">actually work</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Every surface — guest, staff, manager — designed for loud rooms, low light and busy
            hands.
          </p>
        </Reveal>
        <Reveal stagger={0.1} y={40} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <TiltCard key={feature.title} className="h-full rounded-xl">
              <Card className="h-full border-border/60 bg-card/60 py-6 backdrop-blur transition-colors hover:border-primary/40">
                <CardContent className="px-6">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary glow-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
                </CardContent>
              </Card>
            </TiltCard>
          ))}
        </Reveal>
      </section>

      {/* ---------- Pricing preview ---------- */}
      <section className="relative overflow-hidden border-t bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <Reveal className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
              Simple, per-venue pricing
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              No per-order fees, no hardware lock-in. Cancel anytime.
            </p>
          </Reveal>
          <Reveal stagger={0.12} y={36} className="mt-12 grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <TiltCard key={plan.name} maxTilt={5} className="rounded-xl">
                <Card
                  className={
                    plan.highlight
                      ? "border-primary/60 bg-card/80 glow-primary"
                      : "bg-card/60 backdrop-blur"
                  }
                >
                  <CardContent className="px-5 py-2 text-center">
                    <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                    <p className="mt-2 text-3xl font-bold">
                      {plan.price}
                      {plan.price !== "Custom" && (
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                  </CardContent>
                </Card>
              </TiltCard>
            ))}
          </Reveal>
          <Reveal className="mt-10 text-center" delay={0.1}>
            <Magnetic strength={0.25}>
              <Button variant="outline" size="lg" asChild>
                <Link href="/pricing">
                  See full pricing <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Magnetic>
          </Reveal>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="relative overflow-hidden">
        <ClubLights density={200} speed={0.7} className="opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-28 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Ready to upgrade <span className="text-gradient-brand">your nights?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Tell us about your venue and we&apos;ll set up a personalized walkthrough.
            </p>
            <div className="mt-8">
              <Magnetic>
                <Button size="lg" className="h-13 px-8 text-base glow-primary" asChild>
                  <Link href="/lead">
                    Request a demo <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
