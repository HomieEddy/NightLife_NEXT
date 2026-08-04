"use client";

// Plan 10 graduates this demo-only surface.

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowRight, Building2, CircleDollarSign, ExternalLink, Filter, Receipt, Table2, TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { adminService } from "@/features/platform/admin-service";
import { adminKeys } from "@/features/platform/query-keys";
import { formatMoney, timeAgo } from "@/features/shared/format";
import type { Lead, TelemetryLink, Tenant } from "@/lib/types";

export default function AdminOverviewPage() {
  const { data: leads } = useQuery({
    queryKey: adminKeys.leads,
    queryFn: () => adminService.listLeads(),
  });

  const { data: tenants } = useQuery({
    queryKey: adminKeys.tenants,
    queryFn: () => adminService.listTenants(),
  });

  const { data: telemetry = [] } = useQuery({
    queryKey: adminKeys.telemetry,
    queryFn: () => adminService.listTelemetryLinks(),
  });

  const mrr = (tenants ?? []).reduce((sum, t) => sum + t.mrr, 0);
  const activeTenants = (tenants ?? []).filter((t) => t.status === "active").length;
  const openLeads = (leads ?? []).filter((l) => !["won", "lost"].includes(l.status)).length;
  const ops = (tenants ?? []).reduce(
    (acc, t) => ({
      orders: acc.orders + t.metrics.orderCount30d,
      sessions: acc.sessions + t.metrics.sessionCount30d,
      tables: acc.tables + t.metrics.tableCount,
      staff: acc.staff + t.metrics.staffCount,
    }),
    { orders: 0, sessions: 0, tables: 0, staff: 0 },
  );

  const t = useTranslations("admin.overview");

  return (
    <div className="space-y-6">
      <PageHeader title={t("pageTitle")} description={t("pageDesc")} />

      {telemetry.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {telemetry.map((link: TelemetryLink) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              {link.name}
            </a>
          ))}
        </div>
      )}

      {leads === undefined || tenants === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label={t("mrrLabel")} value={formatMoney(mrr)} icon={CircleDollarSign} deltaPct={9.2} featured />
            <MetricCard label={t("activeTenantsLabel")} value={String(activeTenants)} icon={Building2} hint={`${tenants.length} total`} />
            <MetricCard label={t("openLeadsLabel")} value={String(openLeads)} icon={Filter} hint={t("inPipelineHint")} />
            <MetricCard label={t("trialToPaidLabel")} value="64%" icon={TrendingUp} hint={t("last90DaysHint")} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label={t("orders30dLabel")} value={ops.orders.toLocaleString()} icon={Receipt} hint={t("allTenantsHint")} />
            <MetricCard label={t("sessions30dLabel")} value={ops.sessions.toLocaleString()} icon={Activity} hint={t("allTenantsHint")} />
            <MetricCard label={t("tablesLabel")} value={ops.tables.toLocaleString()} icon={Table2} hint={t("provisionedHint")} />
            <MetricCard label={t("staffLabel")} value={ops.staff.toLocaleString()} icon={Users} hint={t("acrossVenuesHint")} />
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("latestLeadsTitle")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/leads">
                {t("pipelineButton")} <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(leads ?? []).slice(0, 4).map((lead: Lead) => (
              <div key={lead.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{lead.venueName}</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.city} · {timeAgo(lead.createdAt)}
                  </p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("tenantsTitle")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/venues">
                {t("allTenantsButton")} <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(tenants ?? []).slice(0, 4).map((tenant: Tenant) => (
              <div key={tenant.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{tenant.venueName}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {tenant.plan} · {tenant.city}
                  </p>
                </div>
                <StatusBadge status={tenant.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
