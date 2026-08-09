"use client";

import { useMemo } from "react";
import { DollarSign, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { tipsService } from "@/features/workforce/tips-service";
import { staffService } from "@/features/workforce/staff-service";
import { staffKeys, tipsKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { formatMoney } from "@/features/shared/format";

export default function StaffTipsPage() {
  const t = useTranslations("staff.tips");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: distributions } = useQuery({
    queryKey: tipsKeys.list(venueId),
    queryFn: () => tipsService.listDistributions(),
    enabled: !!venueId,
  });

  const { data: staff } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const closedDistributions = distributions?.filter((d) => !!d.closedByStaffId) ?? null;

  const staffMap = useMemo(() => {
    if (!staff) return new Map();
    return new Map(staff.map((s) => [s.id, s.name]));
  }, [staff]);

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div>
        <h1 className="text-display flex items-center gap-2 text-xl">
          <DollarSign className="size-5 text-primary" /> {t("title")}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {closedDistributions === null ? (
        <ListSkeleton rows={3} rowHeight="h-24" />
      ) : closedDistributions.length === 0 ? (
        <EmptyState icon={DollarSign} title={t("emptyTitle")} description={t("emptyDesc")} />
      ) : (
        <div className="stagger-children space-y-3">
          {closedDistributions.map((d) => {
            const myLine = d.lines.find((l) => l.staffId === me?.id);
            return (
              <Card key={d.id} className="py-4">
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{d.businessDate}</p>
                    <Badge variant="outline"><Lock className="size-3 mr-1" /> {t("closed")}</Badge>
                  </div>
                  {myLine ? (
                    <p className="text-2xl font-semibold tabular-nums">{formatMoney(myLine.shareCents, "CAD")}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("notIncluded")}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {t("totalPool", { amount: formatMoney(d.poolCents, "CAD") })} · {
                      d.lines.map((l) => `${staffMap.get(l.staffId) ?? l.staffId} ${formatMoney(l.shareCents, "CAD")}`).join(", ")
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
