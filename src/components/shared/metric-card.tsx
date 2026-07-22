import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/shared/info-tip";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  deltaPct,
  icon: Icon,
  info,
  hint,
  className,
  featured = false,
}: {
  label: string;
  value: string;
  deltaPct?: number;
  icon?: LucideIcon;
  info?: string;
  hint?: string;
  className?: string;
  /** The night's headline metric — poster number + gold halo. One per view. */
  featured?: boolean;
}) {
  const positive = deltaPct !== undefined && deltaPct >= 0;
  return (
    <Card className={cn("py-4", featured && "focal-halo", className)}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="label-luxe text-muted-foreground flex items-center gap-1">
            {label}
            {info && <InfoTip text={info} />}
          </p>
          {Icon && <Icon className={cn("size-4", featured ? "text-gold" : "text-primary")} />}
        </div>
        <p
          className={cn(
            "mt-2 tabular-nums",
            featured
              ? "text-display text-gradient-gold text-4xl"
              : "text-2xl font-semibold tracking-tight",
          )}
        >
          {value}
        </p>
        {deltaPct !== undefined && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {positive ? "+" : ""}
            {deltaPct.toFixed(1)}% vs last week
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
