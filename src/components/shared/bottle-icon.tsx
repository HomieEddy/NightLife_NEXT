import {
  Citrus,
  CupSoda,
  Gift,
  Grape,
  Leaf,
  Sailboat,
  Snowflake,
  Sparkles,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BottleIconKey } from "@/lib/types";

const ICON_MAP: Record<BottleIconKey, { icon: LucideIcon; className: string }> = {
  champagne: { icon: Sparkles, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  tequila: { icon: Citrus, className: "bg-lime-500/15 text-lime-600 dark:text-lime-400" },
  vodka: { icon: Snowflake, className: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  cognac: { icon: Grape, className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  rum: { icon: Sailboat, className: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  whisky: { icon: Wheat, className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  gin: { icon: Leaf, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  washer: { icon: CupSoda, className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  package: { icon: Gift, className: "bg-primary/15 text-primary" },
};

/** Tinted icon tile for menu items and packages — replaces emoji art. */
export function BottleIcon({
  icon,
  className,
  iconClassName,
}: {
  icon: BottleIconKey;
  className?: string;
  iconClassName?: string;
}) {
  const meta = ICON_MAP[icon] ?? ICON_MAP.package;
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-lg",
        meta.className,
        className,
      )}
    >
      <meta.icon className={cn("size-5", iconClassName)} />
    </div>
  );
}
