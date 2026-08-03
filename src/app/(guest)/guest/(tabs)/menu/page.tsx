"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Martini, QrCode, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoQrScanAction } from "@/components/shared/demo-links";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { MenuItemCard } from "@/components/shared/menu-item-card";
import { ClosureGate } from "@/components/guest/closure-gate";
import { ItemDetailModal } from "@/components/guest/item-detail-modal";
import { PackageCard, type PackageWithQuote } from "@/components/guest/package-card";
import { useGuest } from "@/context/guest-context";
import { menuService } from "@/features/menu/services";
import { cn } from "@/features/shared/utils";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import type { MenuCategory, MenuItem } from "@/lib/types";

export default function GuestMenuPage() {
  const t = useTranslations("guest.menu");
  const { table } = useGuest();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [packages, setPackages] = useState<PackageWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("packages");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    setTransitioning(true);
    setTimeout(() => setTransitioning(false), 50);
    const list = document.getElementById("menu-results");
    list?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearchChange = (value: string) => {
    setQuery(value);
    clearTimeout(fadeTimer.current);
    setTransitioning(true);
    fadeTimer.current = setTimeout(() => setTransitioning(false), 50);
    const list = document.getElementById("menu-results");
    list?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      menuService.listCategories(),
      menuService.listItems(),
      menuService.listPackages(),
    ])
      .then(([cats, its, pkgs]) => {
        if (!cancelled) {
          setCategories(cats);
          setItems(its);
          setPackages(pkgs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const visible = useMemo(() => {
    let result = items;
    if (activeCategory !== "all" && activeCategory !== "packages")
      result = result.filter((i) => i.categoryId === activeCategory);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, activeCategory, query]);

  const visiblePackages = useMemo(() => {
    if (!query.trim()) return packages;
    const q = query.trim().toLowerCase();
    return packages.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [packages, query]);

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, activeCategory, reset]);

  if (loadError) {
    return (
      <div className="p-4">
        <QueryErrorState
          message={t("nothingMatches")}
          onRetry={() => {
            setLoadError(false);
            setReloadKey((k) => k + 1);
          }}
        />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="p-6">
        <EmptyState
          icon={QrCode}
          title={t("noTable")}
          description={t("noTableDesc")}
          action={<DemoQrScanAction />}
        />
      </div>
    );
  }

  return (
    <ClosureGate>
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-11 pl-9"
        />
      </div>

      <div className="relative">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[{ id: "packages", name: t("packages") }, { id: "all", name: t("allBottles") }, ...categories].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                activeCategory === cat.id
                  ? "border-gold/60 bg-gold/12 text-gold-deep dark:text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
      </div>

      {loading ? (
        <ListSkeleton rows={5} rowHeight="h-20" />
      ) : query.trim() ? (
        visiblePackages.length === 0 && visible.length === 0 ? (
          <EmptyState
            icon={Martini}
            title={t("nothingMatches")}
            description={t("tryDifferentSearch")}
          />
        ) : (
          <div id="menu-results" key={`search-${query}`} className={cn("space-y-3 stagger-children transition-opacity duration-200", transitioning ? "opacity-0" : "opacity-100")}>
            {query.trim() && (
              <p className="text-xs text-muted-foreground">
                {t("resultCount", { count: visiblePackages.length + visible.length, query: query.trim() })}
              </p>
            )}
            {visiblePackages.map((pkg, i) => (
              <PackageCard key={pkg.id} pkg={pkg} featured={i === 0} />
            ))}
            {sliced.map((item) => (
              <MenuItemCard key={item.id} item={item} onClick={() => setOpenItem(item)} />
            ))}
            <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
          </div>
        )
      ) : activeCategory === "packages" ? (
        packages.length === 0 ? (
          <EmptyState
            icon={Martini}
            title={t("noPackages")}
            description={t("browseBottles")}
          />
        ) : (
          <div id="menu-results" key="packages" className={cn("space-y-3 stagger-children transition-opacity duration-200", transitioning ? "opacity-0" : "opacity-100")}>
            {packages.map((pkg, i) => (
              <PackageCard key={pkg.id} pkg={pkg} featured={i === 0} />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Martini}
          title={t("nothingMatches")}
          description={t("tryDifferentSearch")}
        />
      ) : (
        <div id="menu-results" key={`${activeCategory}-${query}`} className={cn("space-y-2.5 stagger-children transition-opacity duration-200", transitioning ? "opacity-0" : "opacity-100")}>
          {sliced.map((item) => (
            <MenuItemCard key={item.id} item={item} onClick={() => setOpenItem(item)} />
          ))}
          <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
        </div>
      )}

      <ItemDetailModal
        item={openItem}
        modifierGroups={
          categories.find((category) => category.id === openItem?.categoryId)?.modifierGroups ?? []
        }
        onClose={() => setOpenItem(null)}
      />
    </div>
    </ClosureGate>
  );
}
