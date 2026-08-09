"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/fx/reveal";
import { ScrollTrigger } from "@/lib/gsap";
import { DemoFeatureBlock } from "@/components/demo/demo-feature-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_GROUPS, demoKeys, WALKTHROUGH } from "./demo-guide-content";
import { useDemoTab, type DemoTabId } from "./demo-tab-context";

const TABBED_GROUP_IDS = new Set<DemoTabId>(["manager", "staff", "guest", "public"]);

const FEATURE_GROUPS = DEMO_GROUPS.filter(
  (g) => g.features.length > 0 && TABBED_GROUP_IDS.has(g.id as DemoTabId),
);

/**
 * Walkthrough, Manager, Staff, Guest, Public as tabs instead of one long
 * stacked list — the sidebar and hero quick-jump pills switch tabs via
 * DemoTabContext, so a link to any feature still lands exactly on it.
 */
export function DemoTourTabs() {
  const { activeTab, setActiveTab } = useDemoTab();
  const t = useTranslations("demo");

  // Radix mounts/unmounts each panel on switch, which shifts page height and
  // leaves GSAP ScrollTrigger's cached positions stale — a newly-mounted
  // panel's Reveal cards would otherwise never cross their trigger point and
  // stay invisible. Refresh once the new panel has settled into layout.
  useEffect(() => {
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DemoTabId)} className="gap-0">
      <TabsList
        variant="line"
        className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border/50 bg-transparent p-0 pb-2"
      >
        <TabsTrigger value="walkthrough" className="gap-1.5 px-3 py-2 text-sm">
          {t("chrome.walkthroughTab")}
        </TabsTrigger>
        {FEATURE_GROUPS.map((group) => (
          <TabsTrigger key={group.id} value={group.id} className="gap-1.5 px-3 py-2 text-sm">
            <group.icon className="size-3.5" />
            {t(demoKeys.group(group.id, "label"))}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="walkthrough" id="walkthrough" className="scroll-mt-24 pt-8">
        <Reveal>
          <p className="text-voice text-sm text-muted-foreground">
            {t(demoKeys.group("getting-started", "intro"))}
          </p>
        </Reveal>
        <Reveal stagger={0.07} y={24} className="mt-5 space-y-3">
          {WALKTHROUGH.map((item, i) => (
            <Card key={item.id} className="bg-card/60 py-4 backdrop-blur">
              <CardContent className="flex flex-wrap items-center gap-4 px-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t(demoKeys.walkthrough(item.id, "step"))}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(demoKeys.walkthrough(item.id, "detail"))}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={item.href}>
                    {t(demoKeys.walkthrough(item.id, "linkLabel"))} <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </Reveal>
      </TabsContent>

      {FEATURE_GROUPS.map((group) => (
        <TabsContent key={group.id} value={group.id} id={group.id} className="scroll-mt-24 pt-8">
          <Reveal>
            <p className="text-voice text-sm text-muted-foreground">
              {t(demoKeys.group(group.id, "intro"))}
            </p>
          </Reveal>
          {/* DemoFeatureBlock reveals itself — no outer Reveal here, or the
              two competing ScrollTrigger tweens leave cards stuck at opacity 0. */}
          <div className="mt-6 space-y-4">
            {group.features.map((feature) => (
              <DemoFeatureBlock key={feature.title} feature={feature} />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
