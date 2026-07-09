"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Euro, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { mockAdminService } from "@/lib/mock-services/admin-service";
import { formatMoney, timeAgo } from "@/lib/format";
import type { Lead, Tenant } from "@/lib/types";

export default function AdminOverviewPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);

  useEffect(() => {
    mockAdminService.listLeads().then(setLeads);
    mockAdminService.listTenants().then(setTenants);
  }, []);

  const mrr = (tenants ?? []).reduce((sum, t) => sum + t.monthlyRevenue, 0);
  const activeTenants = (tenants ?? []).filter((t) => t.status === "active").length;
  const openLeads = (leads ?? []).filter((l) => !["won", "lost"].includes(l.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="NightLifeNext across all venues." />

      {leads === null || tenants === null ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="MRR" value={formatMoney(mrr)} icon={Euro} deltaPct={9.2} />
          <MetricCard label="Active tenants" value={String(activeTenants)} icon={Building2} hint={`${tenants.length} total`} />
          <MetricCard label="Open leads" value={String(openLeads)} icon={Filter} hint="in pipeline" />
          <MetricCard label="Trial → paid" value="64%" icon={TrendingUp} hint="last 90 days" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Latest leads</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/leads">
                Pipeline <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(leads ?? []).slice(0, 4).map((lead) => (
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
            <CardTitle className="text-base">Tenants</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/venues">
                All tenants <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(tenants ?? []).slice(0, 4).map((tenant) => (
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
