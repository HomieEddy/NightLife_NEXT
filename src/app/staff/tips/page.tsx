"use client";

import { useEffect, useState } from "react";
import { DollarSign, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { tipsService } from "@/lib/services/tips-service";
import { staffService } from "@/lib/services/staff-service";
import { formatMoney } from "@/lib/format";
import type { StaffMember, TipDistribution } from "@/lib/types";

export default function StaffTipsPage() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [distributions, setDistributions] = useState<TipDistribution[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  useEffect(() => {
    Promise.all([
      staffService.getCurrentStaff(),
      tipsService.listDistributions(),
      staffService.listStaff(),
    ]).then(([current, ds, s]) => {
      setMe(current);
      setDistributions(ds.filter((d) => !!d.closedByStaffId));
      setStaff(s);
    });
  }, []);

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          <DollarSign className="size-5 text-primary" /> My tips
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Closed distributions shown here after the manager finalizes them.</p>
      </div>

      {distributions === null ? (
        <ListSkeleton rows={3} rowHeight="h-24" />
      ) : distributions.length === 0 ? (
        <EmptyState icon={DollarSign} title="No closed distributions yet" description="Your tip share appears here once the manager closes the night's distribution." />
      ) : (
        <div className="space-y-3">
          {distributions.map((d) => {
            const myLine = d.lines.find((l) => l.staffId === me?.id);
            return (
              <Card key={d.id} className="py-4">
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{d.businessDate}</p>
                    <Badge variant="outline"><Lock className="size-3 mr-1" /> Closed</Badge>
                  </div>
                  {myLine ? (
                    <p className="text-2xl font-bold tabular-nums">{formatMoney(myLine.shareCents, "CAD")}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not included in this distribution.</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Total pool: {formatMoney(d.poolCents, "CAD")} · {
                      d.lines.map((l) => `${staffName(l.staffId)} ${formatMoney(l.shareCents, "CAD")}`).join(", ")
                    }
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
