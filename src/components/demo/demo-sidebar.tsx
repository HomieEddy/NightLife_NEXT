"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DEMO_GROUPS, type DemoFeature } from "./demo-guide-content";

// ── Search helpers ─────────────────────────────────────────────────

function matchFeature(f: DemoFeature, query: string): boolean {
  const q = query.toLowerCase();
  return (
    f.title.toLowerCase().includes(q) ||
    f.what.toLowerCase().includes(q) ||
    f.why.toLowerCase().includes(q)
  );
}

// ── Scroll spy ─────────────────────────────────────────────────────

/** Build flat list of anchor IDs from groups + special sections. */
function buildAnchorIds(): string[] {
  const ids: string[] = [];
  for (const g of DEMO_GROUPS) {
    if (g.id === "getting-started") {
      ids.push("walkthrough", "house-rules");
    }
    for (const f of g.features) {
      ids.push(f.title.toLowerCase().replace(/\s+/g, "-"));
    }
    if (g.id === "how-it-works") {
      // Already covered above via getting-started, but ensure order
    }
  }
  // Dedupe preserving order
  return [...new Set(ids)];
}

function useScrollSpy(): string | null {
  const [active, setActive] = useState<string | null>(null);
  const ids = useMemo(() => buildAnchorIds(), []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const visible = new Map<string, number>(); // id → intersection ratio
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.intersectionRatio);
        }

        let best: string | null = null;
        let bestRatio = 0;
        for (const id of ids) {
          const ratio = visible.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        if (best) setActive(best);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    // Observe all anchors
    const els: Element[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        els.push(el);
      }
    }

    return () => {
      for (const el of els) observer.unobserve(el);
    };
  }, [ids]);

  return active;
}

// ── Nav content (shared between desktop sidebar and mobile Sheet) ──

function SidebarNav({
  query,
  onQueryChange,
  activeAnchor,
  onNav,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  activeAnchor: string | null;
  onNav?: () => void;
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return DEMO_GROUPS;
    return DEMO_GROUPS
      .map((g) => ({
        ...g,
        features: g.features.filter((f) => matchFeature(f, query)),
      }))
      .filter((g) => g.features.length > 0 || g.id === "getting-started" || g.id === "how-it-works");
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="relative px-3 pt-3">
        <Search className="absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter features..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="h-8 pl-8 pr-7 text-xs"
          aria-label="Filter features"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear filter"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <ScrollArea className="flex-1 px-3 pb-6">
        <nav className="mt-4 space-y-6" aria-label="Demo guide navigation">
          {filtered.map((group) => (
            <div key={group.id}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <group.icon className="size-3.5 text-gold-deep dark:text-gold" />
                <span className="label-luxe text-muted-foreground">{group.label}</span>
              </div>
              {group.id === "getting-started" && (
                <>
                  <SidebarNavItem href="#walkthrough" active={activeAnchor === "walkthrough"} onNav={onNav}>
                    Five-minute walkthrough
                  </SidebarNavItem>
                  <SidebarNavItem href="#house-rules" active={activeAnchor === "house-rules"} onNav={onNav}>
                    House rules
                  </SidebarNavItem>
                </>
              )}
              {group.features.map((f) => {
                const anchor = f.title.toLowerCase().replace(/\s+/g, "-");
                return (
                  <SidebarNavItem
                    key={f.title}
                    href={`#${anchor}`}
                    active={activeAnchor === anchor}
                    onNav={onNav}
                  >
                    {f.title}
                  </SidebarNavItem>
                );
              })}
              {group.id === "how-it-works" && (
                <>
                  <SidebarNavItem href="#house-rules" active={activeAnchor === "house-rules"} onNav={onNav}>
                    House rules
                  </SidebarNavItem>
                  <SidebarNavItem href="#walkthrough" active={activeAnchor === "walkthrough"} onNav={onNav}>
                    Walkthrough
                  </SidebarNavItem>
                </>
              )}
              {group.features.length === 0 &&
                group.id !== "getting-started" &&
                group.id !== "how-it-works" && (
                  <p className="px-1 text-xs text-muted-foreground/60">No matches</p>
                )}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}

function SidebarNavItem({
  href,
  children,
  active,
  onNav,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onNav?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNav}
      aria-current={active ? "true" : undefined}
      className={`block rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

// ── Public API ─────────────────────────────────────────────────────

export function DemoSidebar() {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeAnchor = useScrollSpy();

  const handleNav = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <>
      {/* ── Desktop: persistent sidebar ── */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border/60 lg:bg-card/30 lg:backdrop-blur">
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3.5">
          <Link href="/demo" className="label-luxe text-gold-deep hover:text-gold dark:text-gold">
            NightLifeNext
          </Link>
          <span className="text-[0.6rem] text-muted-foreground">Demo Guide</span>
        </div>
        <SidebarNav query={query} onQueryChange={setQuery} activeAnchor={activeAnchor} />
      </aside>

      {/* ── Mobile: Sheet drawer ── */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-border/40 bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Open demo guide menu">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Demo guide navigation</SheetTitle>
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
              <span className="label-luxe text-gold-deep dark:text-gold">NightLifeNext</span>
              <span className="text-[0.6rem] text-muted-foreground">Demo Guide</span>
            </div>
            <SidebarNav query={query} onQueryChange={setQuery} activeAnchor={activeAnchor} onNav={handleNav} />
          </SheetContent>
        </Sheet>
        <Link href="/demo" className="label-luxe text-sm text-gold-deep dark:text-gold">
          NightLifeNext
        </Link>
        <span className="text-[0.6rem] text-muted-foreground">Demo Guide</span>
      </div>

      {/* ── Mobile top spacer so content clears the fixed bar ── */}
      <div className="h-11 lg:hidden" aria-hidden="true" />
    </>
  );
}
