"use client";

import { Megaphone } from "lucide-react";
import { DEMO_GROUPS } from "./demo-guide-content";
import { useDemoTab, type DemoTabId } from "./demo-tab-context";

const TABBED_GROUP_IDS = new Set<DemoTabId>(["manager", "staff", "guest", "public"]);

const FEATURE_GROUPS = DEMO_GROUPS.filter(
  (g) => g.features.length > 0 && TABBED_GROUP_IDS.has(g.id as DemoTabId),
);

/** Hero pills that jump straight to a tab in DemoTourTabs. */
export function DemoQuickJumpPills() {
  const { setActiveTab } = useDemoTab();

  const jump = (tab: DemoTabId) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      document.getElementById("tour-tabs")?.scrollIntoView({ block: "start" });
    });
  };

  return (
    <>
      {FEATURE_GROUPS.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => jump(group.id as DemoTabId)}
          className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-gold/60 hover:text-gold-deep dark:hover:text-gold"
        >
          <group.icon className="size-3.5" />
          {group.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => jump("walkthrough")}
        className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold-deep transition-colors hover:bg-gold/20 dark:text-gold"
      >
        <Megaphone className="size-3.5" /> Walkthrough
      </button>
    </>
  );
}
