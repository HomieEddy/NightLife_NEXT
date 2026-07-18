"use client";

import { useEffect, useMemo, useState } from "react";
import { Martini, QrCode, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoQrScanAction } from "@/components/shared/demo-links";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { MenuItemCard } from "@/components/shared/menu-item-card";
import { ClosureGate } from "@/components/guest/closure-gate";
import { ItemDetailModal } from "@/components/guest/item-detail-modal";
import { PackageCard, type PackageWithQuote } from "@/components/guest/package-card";
import { CartSheet } from "@/components/guest/cart-sheet";
import { useGuest } from "@/context/guest-context";
import { menuService } from "@/lib/services/menu-service";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/lib/types";

export default function GuestMenuPage() {
  const { table } = useGuest();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [packages, setPackages] = useState<PackageWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("packages");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      menuService.listCategories(),
      menuService.listItems(),
      menuService.listPackages(),
    ]).then(([cats, its, pkgs]) => {
      if (!cancelled) {
        setCategories(cats);
        setItems(its);
        setPackages(pkgs);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!table) {
    return (
      <div className="p-6">
        <EmptyState
          icon={QrCode}
          title="No table joined"
          description="Scan the QR code on your table to browse the menu."
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
          placeholder="Search drinks, bottles, bites…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 pl-9"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[{ id: "packages", name: "Packages" }, { id: "all", name: "All bottles" }, ...categories].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
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

      {loading ? (
        <ListSkeleton rows={5} rowHeight="h-20" />
      ) : query.trim() ? (
        visiblePackages.length === 0 && visible.length === 0 ? (
          <EmptyState
            icon={Martini}
            title="Nothing matches"
            description="Try a different search or category."
          />
        ) : (
          <div key={`search-${query}`} className="space-y-3 stagger-children">
            {visiblePackages.map((pkg, i) => (
              <PackageCard key={pkg.id} pkg={pkg} featured={i === 0} />
            ))}
            {visible.map((item) => (
              <MenuItemCard key={item.id} item={item} onClick={() => setOpenItem(item)} />
            ))}
          </div>
        )
      ) : activeCategory === "packages" ? (
        packages.length === 0 ? (
          <EmptyState
            icon={Martini}
            title="No packages tonight"
            description="Browse the bottle list instead."
          />
        ) : (
          <div key="packages" className="space-y-3 stagger-children">
            {packages.map((pkg, i) => (
              <PackageCard key={pkg.id} pkg={pkg} featured={i === 0} />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Martini}
          title="Nothing matches"
          description="Try a different search or category."
        />
      ) : (
        <div key={`${activeCategory}-${query}`} className="space-y-2.5 stagger-children">
          {visible.map((item) => (
            <MenuItemCard key={item.id} item={item} onClick={() => setOpenItem(item)} />
          ))}
        </div>
      )}

      <ItemDetailModal
        item={openItem}
        modifierGroups={
          categories.find((category) => category.id === openItem?.categoryId)?.modifierGroups ?? []
        }
        onClose={() => setOpenItem(null)}
      />
      <CartSheet />
    </div>
    </ClosureGate>
  );
}
