"use client";

import {
  AlertTriangle, Bot, Boxes, CalendarCheck, CalendarDays, CircleDollarSign,
  Clock, FileText, Gauge, Megaphone, PartyPopper, Play,
  Receipt, RefreshCw, Shield, ShoppingCart, UserCheck, Users, Wine, Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureGate } from "@/components/shared/feature-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { automationService } from "@/features/automation/services";
import { automationKeys } from "@/features/automation/query-keys";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { cn } from "@/features/shared/utils";
import type { AutomationCode, AutomationRule } from "@/lib/types";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  reservations: <CalendarCheck className="size-4" />,
  orders: <Receipt className="size-4" />,
  inventory: <Boxes className="size-4" />,
  vip: <UserCheck className="size-4" />,
  events: <PartyPopper className="size-4" />,
  reports: <FileText className="size-4" />,
};

const CODE_ICONS: Record<AutomationCode, React.ReactNode> = {
  "auto-release-reservations": <CalendarDays className="size-4" />,
  "auto-generate-po": <ShoppingCart className="size-4" />,
  "auto-escalate-orders": <AlertTriangle className="size-4" />,
  "auto-detect-duplicates": <Users className="size-4" />,
  "auto-vip-tier-upgrade": <UserCheck className="size-4" />,
  "auto-event-pricing": <PartyPopper className="size-4" />,
  "auto-close-event": <Clock className="size-4" />,
  "auto-remove-86": <RefreshCw className="size-4" />,
  "auto-pour-cost": <Wine className="size-4" />,
  "auto-flag-variance": <Gauge className="size-4" />,
  "auto-notify-vip-arrival": <Megaphone className="size-4" />,
  "auto-flag-dormant-vip": <Shield className="size-4" />,
  "auto-suggest-table": <CircleDollarSign className="size-4" />,
  "auto-close-abandoned-sessions": <Clock className="size-4" />,
};

export default function ManagerAutomationsPage() {
  return (
    <FeatureGate feature="analytics">
      <AutomationsPageContent />
    </FeatureGate>
  );
}

function AutomationsPageContent() {
  const t = useTranslations("manager.automations");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: automationKeys.rules(venueId) });
    queryClient.invalidateQueries({ queryKey: automationKeys.executions(venueId) });
  };

  const { data: rules } = useQuery({
    queryKey: automationKeys.rules(venueId),
    queryFn: () => automationService.listRules(),
    enabled: !!venueId,
  });

  const { data: executions } = useQuery({
    queryKey: automationKeys.executions(venueId),
    queryFn: () => automationService.listExecutions(50),
    enabled: !!venueId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, current }: { ruleId: string; current: boolean }) =>
      automationService.setEnabled(ruleId, !current),
    onSuccess: (updated) => {
      toast.success(updated.enabled ? t("automationEnabled") : t("automationDisabled"));
      queryClient.invalidateQueries({ queryKey: automationKeys.rules(venueId) });
    },
    onError: () => toast.error(t("couldNotUpdate")),
  });

  const triggerMutation = useMutation({
    mutationFn: (rule: AutomationRule) => automationService.triggerRule(rule.id),
    onSuccess: () => {
      toast.success(t("triggered"));
      queryClient.invalidateQueries({ queryKey: automationKeys.executions(venueId) });
    },
    onError: () => toast.error(t("triggerFailed")),
  });

  if (!rules || !executions) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const groups = new Map<string, AutomationRule[]>();
  for (const r of rules) {
    const list = groups.get(r.category) ?? [];
    list.push(r);
    groups.set(r.category, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("insights"), href: "/manager/reports" }, { label: t("title") }]}
      />

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Zap className="size-4 text-primary" />
          {t("enabledCount", { enabled: rules.filter((r) => r.enabled).length, total: rules.length })}
        </span>
        <span className="flex items-center gap-1.5">
          <Bot className="size-4" />
          {t("executions", { count: executions.length })}
        </span>
        <Button variant="ghost" size="sm" onClick={invalidate}>
          <RefreshCw className="size-3.5" /> {t("refresh")}
        </Button>
      </div>

      {Array.from(groups.entries()).map(([category, categoryRules]) => (
        <div key={category} className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold capitalize text-muted-foreground">
            {CATEGORY_ICONS[category]}
            {category}
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {categoryRules.map((rule) => (
              <Card key={rule.id} className={cn(!rule.enabled && "opacity-60")}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-0.5 text-muted-foreground">
                        {CODE_ICONS[rule.code]}
                      </span>
                      <div>
                        <CardTitle className="text-sm">{rule.label}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleMutation.mutate({ ruleId: rule.id, current: rule.enabled })}
                      disabled={toggleMutation.isPending && toggleMutation.variables?.ruleId === rule.id}
                      aria-label={`${rule.enabled ? t("disable") : t("enable")} ${rule.label}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.keys(rule.config).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Object.entries(rule.config).map(([key, value]) => (
                        <span key={key} className="rounded bg-muted px-2 py-0.5">
                          {key}: <span className="font-medium">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {rule.lastTriggeredAt
                        ? t("lastTriggered", { date: new Date(rule.lastTriggeredAt).toLocaleString() })
                        : t("neverTriggered")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={triggerMutation.isPending && triggerMutation.variables?.id === rule.id}
                      onClick={() => triggerMutation.mutate(rule)}
                    >
                      <Play className="size-3" />
                      {triggerMutation.isPending && triggerMutation.variables?.id === rule.id
                        ? t("running")
                        : t("triggerNow")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("executionLog")}</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noExecutions")}</p>
          ) : (
            <div className="space-y-3">
              {executions.map((exe) => {
                const rule = rules.find((r) => r.id === exe.ruleId);
                return (
                  <div key={exe.id} className="flex items-start gap-3 border-b border-muted pb-3 last:border-0 last:pb-0">
                    <span className={cn(
                      "mt-0.5 rounded p-1",
                      exe.actionApplied ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground",
                    )}>
                      {exe.actionApplied ? <Zap className="size-3" /> : <Bot className="size-3" />}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{rule?.label ?? exe.code}</span>
                        {exe.actionApplied
                          ? <Badge variant="default" className="h-4 px-1 text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t("applied")}</Badge>
                          : <Badge variant="outline" className="h-4 px-1 text-[10px]">{t("advisory")}</Badge>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground">{exe.result}</p>
                      <div className="flex gap-3 text-[11px] text-muted-foreground">
                        <span>{new Date(exe.triggeredAt).toLocaleString()}</span>
                        <span>{exe.durationMs}ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
