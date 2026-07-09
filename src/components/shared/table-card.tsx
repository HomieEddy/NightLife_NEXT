import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VenueTable } from "@/lib/types";
import { Users } from "lucide-react";

export function TableCard({
  table,
  zoneName,
  footer,
  className,
}: {
  table: VenueTable;
  zoneName?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("py-4 gap-2", className)}>
      <CardContent className="px-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-semibold">{table.code}</p>
            <p className="text-sm text-muted-foreground">{table.label}</p>
          </div>
          <StatusBadge status={table.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> {table.seats} seats
          </span>
          {table.minimumSpend !== null && (
            <span>Min. spend {formatMoney(table.minimumSpend)}</span>
          )}
          {zoneName && <span>{zoneName}</span>}
        </div>
        {footer && <div className="border-t pt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}
