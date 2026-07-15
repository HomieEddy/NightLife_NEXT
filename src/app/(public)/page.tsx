"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClubLights } from "@/components/fx/club-lights";
import { Reveal } from "@/components/fx/reveal";
import { NightTimeline } from "@/components/landing/night-timeline";
import { cn } from "@/lib/utils";
import { gsap, useGSAP } from "@/lib/gsap";
import { isDemoMode } from "@/lib/app-mode";
import { DEMO_APP_URL } from "@/lib/app-origins";

/** Real modules shipped in the manager app — not marketing bullets. */
const MODULES = [
  "orders",
  "tables",
  "zones",
  "menu",
  "qr-codes",
  "staff",
  "reservations",
  "floor-map",
  "inventory",
  "happy-hour",
  "promotions",
  "events",
  "team-chat",
  "reports",
];

const PLANS = [
  { name: "Starter", price: "$0.99", tagline: "Single-room venues", highlight: false },
  { name: "Pro", price: "$1.99", tagline: "Multi-zone clubs", highlight: true },
  { name: "Enterprise", price: "Custom", tagline: "Groups & franchises", highlight: false },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const demoHref = isDemoMode() ? "/demo" : DEMO_APP_URL;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from(".hero-eyebrow", { autoAlpha: 0, y: 14, duration: 0.6 })
          .from(".hero-line-inner", { yPercent: 110, duration: 1, stagger: 0.14 }, "-=0.3")
          .from(".hero-item", { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.1 }, "-=0.55");
      });
    },
    { scope: heroRef },
  );

  return (
    <>
      {/* ---------- Hero: club-poster headline over the ambient light field ---------- */}
      <section
        ref={heroRef}
        className="relative flex min-h-[92dvh] flex-col justify-center overflow-hidden"
      >
        <ClubLights density={420} className="opacity-80" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 380px at 30% 15%, oklch(0.72 0.18 55 / 22%), transparent), radial-gradient(520px 340px at 85% 70%, oklch(0.6 0.21 30 / 13%), transparent), radial-gradient(ellipse at bottom, var(--background) 20%, transparent 60%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-20">
          <p className="hero-eyebrow font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Nightlife operations platform — private beta
          </p>

          <h1 className="mt-6 font-display uppercase leading-[0.92] tracking-[0.01em] text-[clamp(3.5rem,11vw,9rem)]">
            <span className="block overflow-hidden pb-[0.06em]">
              <span className="hero-line-inner block will-change-transform">Run the</span>
            </span>
            <span className="block overflow-hidden pb-[0.06em]">
              <span className="hero-line-inner block will-change-transform">
                whole <span className="text-outline">room.</span>
              </span>
            </span>
          </h1>

          <p className="hero-item mt-7 max-w-xl text-base text-muted-foreground sm:text-lg">
            QR ordering at the booth, bottle-service approvals, runner routing and live night
            analytics — one system built for nightclubs, not restaurants.
          </p>

          <div className="hero-item mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-7 text-base glow-primary" asChild>
              <Link href="/lead">
                Request a demo <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 bg-background/40 px-7 text-base backdrop-blur"
              asChild
            >
              <Link href={demoHref}>
                <Smartphone className="size-4" /> Explore the live demo
              </Link>
            </Button>
          </div>

          {/* Ops readout: what the manager screen looks like mid-shift. */}
          <div className="hero-item mt-16 flex flex-wrap gap-x-8 gap-y-2 border-t border-border/60 pt-5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-2 text-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Sat 00:42
            </span>
            <span>38 tables seated</span>
            <span>6 bottles en route</span>
            <span>214 orders tonight</span>
          </div>
        </div>

        <div className="hero-item pointer-events-none absolute inset-x-0 bottom-5 hidden justify-center sm:flex">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Scroll — the night starts at 22:00
          </p>
        </div>
      </section>

      {/* ---------- One Saturday, start to close ---------- */}
      <NightTimeline />

      {/* ---------- Module index: everything else in the system ---------- */}
      <section className="border-y border-border/60 bg-card/30 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              And the rest of the back of house
            </p>
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 font-mono text-sm text-foreground/70">
              {MODULES.map((module) => (
                <span key={module}>
                  <span className="text-primary/70">/</span>
                  {module}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-24">
          <Reveal>
            <h2 className="font-display text-3xl uppercase leading-none tracking-[0.01em] sm:text-5xl">
              Per venue. That&apos;s it.
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              No per-order fees, no hardware lock-in. Cancel anytime.
            </p>
          </Reveal>
          <Reveal
            stagger={0.1}
            className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3"
          >
            {PLANS.map((plan) => (
              <div key={plan.name} className={cn("relative bg-card p-6", plan.highlight && "bg-card/95")}>
                {plan.highlight && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" aria-hidden />
                )}
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {plan.name}
                  </p>
                  {plan.highlight && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                      Most clubs
                    </span>
                  )}
                </div>
                <p className="mt-5 font-mono text-3xl font-semibold tabular-nums">
                  {plan.price}
                  {plan.price !== "Custom" && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              </div>
            ))}
          </Reveal>
          <Reveal className="mt-8" delay={0.1}>
            <Button variant="outline" asChild>
              <Link href="/pricing">
                See full pricing <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="relative overflow-hidden border-t border-border/60">
        <ClubLights density={200} speed={0.7} className="opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-28 text-center">
          <Reveal>
            <h2 className="font-display text-4xl uppercase leading-[0.95] tracking-[0.01em] sm:text-7xl">
              Saturday <span className="text-outline">is coming.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              Tell us about your venue and we&apos;ll walk you through a full night — doors to
              close — before the weekend.
            </p>
            <div className="mt-8">
              <Button size="lg" className="h-13 px-8 text-base glow-primary" asChild>
                <Link href="/lead">
                  Request a demo <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
