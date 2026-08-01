"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export const DEMO_TAB_IDS = ["walkthrough", "manager", "staff", "guest", "public"] as const;
export type DemoTabId = (typeof DEMO_TAB_IDS)[number];

export function isDemoTabId(id: string): id is DemoTabId {
  return (DEMO_TAB_IDS as readonly string[]).includes(id);
}

interface DemoTabContextValue {
  activeTab: DemoTabId;
  setActiveTab: (tab: DemoTabId) => void;
  /** Switch to a tab, then scroll its anchor into view once the panel mounts. */
  goToAnchor: (tab: DemoTabId, anchorId: string) => void;
}

const DemoTabContext = createContext<DemoTabContextValue | null>(null);

export function DemoTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<DemoTabId>("walkthrough");

  const goToAnchor = useCallback((tab: DemoTabId, anchorId: string) => {
    setActiveTab(tab);
    // Radix unmounts inactive tab panels — wait a couple frames for the
    // target panel to mount before scrolling to its anchor.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: "start" });
      });
    });
  }, []);

  return (
    <DemoTabContext.Provider value={{ activeTab, setActiveTab, goToAnchor }}>
      {children}
    </DemoTabContext.Provider>
  );
}

export function useDemoTab() {
  const ctx = useContext(DemoTabContext);
  if (!ctx) throw new Error("useDemoTab must be used within DemoTabProvider");
  return ctx;
}
