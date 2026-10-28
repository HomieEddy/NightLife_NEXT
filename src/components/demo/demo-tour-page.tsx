"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/features/shared/app-mode";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/fx/reveal";
import { ClubLights } from "@/components/fx/club-lights";
import { Spotlights } from "@/components/fx/spotlights";
import { DemoQr } from "@/components/demo/demo-qr";
import { DemoSidebar } from "@/components/demo/demo-sidebar";
import { DemoTabProvider } from "@/components/demo/demo-tab-context";
import { DemoTourTabs } from "@/components/demo/demo-tour-tabs";
import { DemoQuickJumpPills } from "@/components/demo/demo-quick-jump-pills";
import { DEMO_GROUPS, demoKeys, featureAnchorId, HOUSE_RULES } from "./demo-guide-content";

// The "Getting started" group and its extra companion hold intro content
const GETTING_STARTED = DEMO_GROUPS.find((g) => g.id === "getting-started");
const GETTING_STARTED_EXTRA = DEMO_GROUPS.find((g) => g.id === "getting-started-extra");
const HOW_IT_WORKS = DEMO_GROUPS.find((g) => g.id === "how-it-works");

export default function DemoTourPage() {
  const t = useTranslations("demo");
  if (!isDemoMode()) return null;
  return (
    <DemoTabProvider>
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Fixed, full-viewport animated background — covers the whole page as
          you scroll, so there's no seam where the effect used to end. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        <ClubLights density={400} className="opacity-70" />
      </div>

      <DemoSidebar />

      {/* ── Content column ── */}
      <main className="min-w-0 flex-1 relative">
        {/* Stage spotlights — full main-column width, not clipped to the
            narrower hero text column, so beams can swing edge to edge. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[min(640px,100dvh)] overflow-hidden">
          <Spotlights className="opacity-90" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* ══════════ Hero ══════════ */}
          <section className="grain-overlay relative -mx-4 px-4 py-16 text-center sm:-mx-6 sm:py-24 lg:-mx-8">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background: "radial-gradient(ellipse at bottom, var(--background) 25%, transparent 65%)",
              }}
            />
            <Reveal className="relative">
              <Badge
                variant="outline"
                className="mb-6 gap-1.5 border-gold/40 bg-background/50 text-gold-deep backdrop-blur dark:text-gold"
              >
                <Sparkles className="size-3" /> {t("hero.badge")}
              </Badge>
              <h1 className="text-display mx-auto max-w-3xl text-[clamp(2.5rem,7vw,5rem)]">
                {t("hero.titleTake")}{" "}
                <span className="text-gradient-gold">{t("hero.titleLiveDemo")}</span>{" "}
                <span className="text-outline">{t("hero.titleTour")}</span>
              </h1>
              <p className="text-voice mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                {t("hero.subtitle")}
              </p>
            </Reveal>

            {/* Quick-jump pills */}
            <Reveal
              delay={0.1}
              className="relative mt-8 flex flex-wrap items-center justify-center gap-2"
            >
              <DemoQuickJumpPills />
            </Reveal>
            <hr className="rule-gold absolute inset-x-8 bottom-0" aria-hidden="true" />
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
                    <h2 className="text-display text-xl sm:text-2xl">
                      {t(demoKeys.group(GETTING_STARTED.id, "label"))}
                    </h2>
                    <p className="text-voice text-sm text-muted-foreground">
                      {t(demoKeys.group(GETTING_STARTED.id, "intro"))}
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
                    id={featureAnchorId(f)}
                    className="scroll-mt-24 bg-card/60 py-5 backdrop-blur sm:col-span-2"
                  >
                    <CardContent className="flex flex-col items-start gap-4 px-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
                      <DemoQr
                        path={f.href}
                        className="size-24 shrink-0 overflow-hidden rounded-lg border bg-white p-1.5 [&_svg]:size-full"
                      />
                      <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                        <div className="flex items-center gap-2">
                          <f.icon className="size-4 text-gold-deep dark:text-gold" />
                          <h3 className="font-semibold">{t(demoKeys.feature(f, "title"))}</h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t(demoKeys.feature(f, "what"))}
                        </p>
                        <p className="text-voice mt-0.5 text-sm text-muted-foreground">
                          {t(demoKeys.feature(f, "why"))}
                        </p>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={f.href}>
                          {t("hero.openGuestQr")} <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {/* Three role surfaces */}
                {GETTING_STARTED_EXTRA?.features.map((f) => (
                  <Card
                    key={f.title}
                    id={featureAnchorId(f)}
                    className="group scroll-mt-24 bg-card/60 py-5 backdrop-blur transition-colors hover:border-gold/40"
                  >
                    <CardContent className="px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
                          <f.icon className="size-4 text-gold-deep dark:text-gold" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{t(demoKeys.feature(f, "title"))}</h3>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t(demoKeys.feature(f, "what"))}
                      </p>
                      <p className="text-voice mt-1 text-sm text-muted-foreground">
                        {t(demoKeys.feature(f, "why"))}
                      </p>
                      <Link
                        href={f.href}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline dark:text-gold"
                      >
                        {t("hero.open")} {t(demoKeys.feature(f, "title")).split(" ")[0].toLowerCase()}{" "}
                        <ArrowRight className="size-3" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </Reveal>
            </section>
          )}

          {/* ══════════ Walkthrough / Manager / Staff / Guest / Public tabs ══════════ */}
          <section id="tour-tabs" className="mt-16 scroll-mt-24">
            <DemoTourTabs />
          </section>

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
                    {t(demoKeys.group(HOW_IT_WORKS?.id ?? "how-it-works", "label"))}
                  </h2>
                  <p className="text-voice text-sm text-muted-foreground">
                    {t(demoKeys.group(HOW_IT_WORKS?.id ?? "how-it-works", "intro"))}
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
                  key={rule.id}
                  className="border-gold/15 p-5 max-lg:[&:nth-child(n+2)]:border-t lg:[&:nth-child(n+2)]:border-l sm:max-lg:[&:nth-child(2)]:border-t-0 sm:max-lg:[&:nth-child(even)]:border-l"
                >
                  <rule.icon className="size-4 text-gold-deep dark:text-gold" />
                  <h3 className="mt-3 text-sm font-semibold">{t(demoKeys.rule(rule.id, "title"))}</h3>
                  <p className="text-voice mt-1 text-sm text-muted-foreground">
                    {t(demoKeys.rule(rule.id, "line"))}
                  </p>
                  {rule.href && (
                    <Link
                      href={rule.href}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline dark:text-gold"
                    >
                      {t(demoKeys.rule(rule.id, "linkLabel"))} <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>
              ))}
            </Reveal>
          </section>

        </div>
      </main>
    </div>
    </DemoTabProvider>
  );
}
