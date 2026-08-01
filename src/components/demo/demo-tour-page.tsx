import Link from "next/link";
import {
  ArrowRight,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/fx/reveal";
import { ClubLights } from "@/components/fx/club-lights";
import { DemoQr } from "@/components/demo/demo-qr";
import { DemoSidebar } from "@/components/demo/demo-sidebar";
import { DemoFeatureBlock } from "@/components/demo/demo-feature-block";
import {
  DEMO_GROUPS,
  HOUSE_RULES,
  WALKTHROUGH,
} from "./demo-guide-content";

// ── Groups that should render their feature blocks ──
const FEATURE_GROUPS = DEMO_GROUPS.filter(
  (g) =>
    g.features.length > 0 &&
    g.id !== "getting-started" &&
    g.id !== "getting-started-extra",
);

// The "Getting started" group and its extra companion hold intro content
const GETTING_STARTED = DEMO_GROUPS.find((g) => g.id === "getting-started");
const GETTING_STARTED_EXTRA = DEMO_GROUPS.find((g) => g.id === "getting-started-extra");
const HOW_IT_WORKS = DEMO_GROUPS.find((g) => g.id === "how-it-works");

export default function DemoTourPage() {
  return (
    <div className="flex min-h-screen">
      <DemoSidebar />

      {/* ── Content column ── */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* ══════════ Hero ══════════ */}
          <section className="grain-overlay relative -mx-4 overflow-hidden px-4 py-16 text-center sm:-mx-6 sm:py-24 lg:-mx-8">
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
              <h1 className="text-display mx-auto max-w-3xl text-[clamp(2.5rem,7vw,5rem)]">
                Take the{" "}
                <span className="text-gradient-gold">live demo</span>{" "}
                <span className="text-outline">tour</span>
              </h1>
              <p className="text-voice mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Four surfaces, one nightclub. Manager runs the venue, staff works the floor, guests
                order from the table, and admin runs the platform. Every feature linked straight into
                the sandbox.
              </p>
            </Reveal>

            {/* Quick-jump pills */}
            <Reveal
              delay={0.1}
              className="relative mt-8 flex flex-wrap items-center justify-center gap-2"
            >
              {FEATURE_GROUPS.map((group) => (
                <a
                  key={group.id}
                  href={`#${group.id}`}
                  className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-gold/60 hover:text-gold-deep dark:hover:text-gold"
                >
                  <group.icon className="size-3.5" />
                  {group.label}
                </a>
              ))}
              <a
                href="#walkthrough"
                className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold-deep transition-colors hover:bg-gold/20 dark:text-gold"
              >
                <Megaphone className="size-3.5" /> Walkthrough
              </a>
            </Reveal>
            <hr className="rule-gold absolute inset-x-8 bottom-0" aria-hidden="true" />
          </section>

          {/* ══════════ Walkthrough (right after hero) ══════════ */}
          <section id="walkthrough" className="mt-16 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                  <Megaphone className="size-4 text-gold-deep dark:text-gold" />
                </div>
                <div>
                  <h2 className="text-display text-xl sm:text-2xl">The 5-minute walkthrough</h2>
                  <p className="text-sm text-muted-foreground">
                    The fastest way to feel the whole loop. Use in-app links between steps so
                    the night doesn&apos;t reset.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal stagger={0.07} y={24} className="mt-5 space-y-3">
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
          </section>

          {/* ══════════ Getting started: four surfaces ══════════ */}
          {GETTING_STARTED && (
            <section className="mt-16 scroll-mt-24">
              <Reveal>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                    <GETTING_STARTED.icon className="size-4 text-gold-deep dark:text-gold" />
                  </div>
                  <div>
                    <h2 className="text-display text-xl sm:text-2xl">{GETTING_STARTED.label}</h2>
                    <p className="text-voice text-sm text-muted-foreground">
                      {GETTING_STARTED.intro}
                    </p>
                  </div>
                </div>
              </Reveal>

              {/* Demo QR + four surface cards */}
              <Reveal stagger={0.06} y={20} className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Demo QR card */}
                {GETTING_STARTED.features.map((f) => (
                  <Card
                    key={f.title}
                    className="bg-card/60 py-5 backdrop-blur sm:col-span-2"
                  >
                    <CardContent className="flex flex-wrap items-center gap-5 px-5">
                      <DemoQr
                        path={f.href}
                        className="size-24 shrink-0 overflow-hidden rounded-lg border bg-white p-1.5 [&_svg]:size-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <f.icon className="size-4 text-gold-deep dark:text-gold" />
                          <h3 className="font-semibold">{f.title}</h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{f.what}</p>
                        <p className="text-voice mt-0.5 text-sm text-muted-foreground">
                          {f.why}
                        </p>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={f.href}>
                          Open guest QR <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {/* Three role surfaces */}
                {GETTING_STARTED_EXTRA?.features.map((f) => (
                  <Card
                    key={f.title}
                    className="group bg-card/60 py-5 backdrop-blur transition-colors hover:border-gold/40"
                  >
                    <CardContent className="px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
                          <f.icon className="size-4 text-gold-deep dark:text-gold" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{f.title}</h3>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{f.what}</p>
                      <p className="text-voice mt-1 text-sm text-muted-foreground">{f.why}</p>
                      <Link
                        href={f.href}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline dark:text-gold"
                      >
                        Open {f.title.split(" ")[0].toLowerCase()} <ArrowRight className="size-3" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </Reveal>
            </section>
          )}

          {/* ══════════ Feature groups: Manager, Staff, Guest, Admin, Public ══════════ */}
          {FEATURE_GROUPS.map((group) => (
            <section key={group.id} id={group.id} className="mt-16 scroll-mt-24">
              <Reveal>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                    <group.icon className="size-4 text-gold-deep dark:text-gold" />
                  </div>
                  <div>
                    <h2 className="text-display text-xl sm:text-2xl">{group.label}</h2>
                    <p className="text-voice text-sm text-muted-foreground">{group.intro}</p>
                  </div>
                </div>
              </Reveal>
              <div className="mt-6 space-y-4">
                {group.features.map((feature) => (
                  <DemoFeatureBlock key={feature.title} feature={feature} />
                ))}
              </div>
            </section>
          ))}

          {/* ══════════ How the demo works (house rules) ══════════ */}
          <section id="house-rules" className="mt-16 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                  {(() => {
                    const Icon = HOW_IT_WORKS?.icon ?? Sparkles;
                    return <Icon className="size-4 text-gold-deep dark:text-gold" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-display text-xl sm:text-2xl">
                    {HOW_IT_WORKS?.label ?? "How the demo works"}
                  </h2>
                  <p className="text-voice text-sm text-muted-foreground">
                    {HOW_IT_WORKS?.intro ??
                      "The sandbox rules — ten seconds, then go play."}
                  </p>
                </div>
              </div>
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

          {/* ══════════ Lead CTA ══════════ */}
          <section className="mt-20 scroll-mt-24">
            <Reveal className="text-center">
              <p className="text-voice text-base text-muted-foreground">
                Like what you see? Tell us about your venue.
              </p>
              <Button
                size="lg"
                variant="foil"
                className="foil-shimmer mt-4 h-12 px-7 glow-gold"
                asChild
              >
                <Link href="/lead">
                  Request a personalized demo <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Reveal>
          </section>
        </div>
      </main>
    </div>
  );
}
