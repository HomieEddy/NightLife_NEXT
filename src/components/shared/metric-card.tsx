import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  deltaPct,
  icon: Icon,
  hint,
  className,
}: {
  label: string;
  value: string;
  deltaPct?: number;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}) {
  const positive = deltaPct !== undefined && deltaPct >= 0;
  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {Icon && <Icon className="size-4 text-primary" />}
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
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
