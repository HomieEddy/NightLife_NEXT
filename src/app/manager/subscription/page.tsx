"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  mockBillingService, PLANS, type Invoice, type Subscription,
} from "@/lib/mock-services/billing-service";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TenantPlan } from "@/lib/types";

const PLAN_ORDER: TenantPlan[] = ["starter", "pro", "enterprise"];

export default function ManagerSubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [changing, setChanging] = useState<TenantPlan | null>(null);

  const refresh = useCallback(async () => {
    const [sub, inv] = await Promise.all([
      mockBillingService.getSubscription(),
      mockBillingService.listInvoices(),
    ]);
    setSubscription(sub);
    setInvoices(inv);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function changePlan(plan: TenantPlan) {
    setChanging(plan);
    // TODO(backend): Stripe checkout / proration flow.
    await mockBillingService.changePlan(plan);
    setChanging(null);
    toast.success(`Switched to the ${PLANS.find((p) => p.id === plan)?.name} plan`);
    await refresh();
  }

  if (subscription === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Subscription" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const currentPlan = PLANS.find((p) => p.id === subscription.plan)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Your NightLife plan, billing and invoices."
      />

      {/* ---------- Current plan + payment ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{currentPlan.name}</p>
              <Badge
                variant="outline"
                className={cn(
                  subscription.status === "active" &&
                    "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
                  subscription.status === "past_due" &&
                    "border-red-500/40 text-red-600 dark:text-red-400",
                )}
              >
                {subscription.status === "past_due" ? "Past due" : subscription.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatMoney(currentPlan.monthlyPrice)}/month · renews{" "}
              {new Date(subscription.renewsAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-primary" /> Payment method
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {subscription.paymentMethod.brand} ···· {subscription.paymentMethod.last4}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {subscription.paymentMethod.expires}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Card management arrives with the billing backend.")}
            >
              Update card
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Plans ---------- */}
      <div className="grid gap-3 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS.find((p) => p.id === planId)!;
          const isCurrent = plan.id === subscription.plan;
          const isUpgrade =
            PLAN_ORDER.indexOf(plan.id) > PLAN_ORDER.indexOf(subscription.plan);
          return (
            <Card
              key={plan.id}
              className={cn("py-4", isCurrent && "border-primary ring-1 ring-primary/40")}
            >
              <CardContent className="flex h-full flex-col gap-3 px-4">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{plan.name}</p>
                    {isCurrent && (
                      <Badge className="bg-primary/15 text-primary" variant="outline">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1">
                    <span className="text-2xl font-bold tabular-nums">
                      {formatMoney(plan.monthlyPrice)}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {plan.tableLimit === null ? "Unlimited tables" : `Up to ${plan.tableLimit} tables`}
                    {" · "}
                    {plan.staffLimit === null ? "unlimited staff" : `${plan.staffLimit} staff`}
                  </p>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" disabled>
                    Your plan
                  </Button>
                ) : isUpgrade ? (
                  <ConfirmDialog
                    trigger={
                      <Button disabled={changing !== null}>
                        {changing === plan.id && <Loader2 className="size-4 animate-spin" />}
                        {changing === plan.id ? "Upgrading…" : `Upgrade to ${plan.name}`}
                      </Button>
                    }
                    title={`Upgrade to ${plan.name}?`}
                    description={`Your card is charged ${formatMoney(plan.monthlyPrice)}/month starting at the next renewal, prorated for this cycle.`}
                    confirmLabel={`Upgrade — ${formatMoney(plan.monthlyPrice)}/mo`}
                    onConfirm={() => changePlan(plan.id)}
                  />
                ) : (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" disabled={changing !== null}>
                        {changing === plan.id && <Loader2 className="size-4 animate-spin" />}
                        {changing === plan.id ? "Switching…" : `Downgrade to ${plan.name}`}
                      </Button>
                    }
                    title={`Downgrade to ${plan.name}?`}
                    description={`Limits drop to ${plan.tableLimit ?? "unlimited"} tables and ${plan.staffLimit ?? "unlimited"} staff at the next renewal. Features above this tier are disabled.`}
                    confirmLabel="Downgrade"
                    destructive
                    onConfirm={() => changePlan(plan.id)}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ---------- Invoices ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4 text-primary" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-mono text-xs font-semibold">{invoice.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.date).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{formatMoney(invoice.amount)}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      invoice.status === "paid" &&
                        "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {invoice.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info("PDF invoices arrive with the billing backend.")}
                  >
                    PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
