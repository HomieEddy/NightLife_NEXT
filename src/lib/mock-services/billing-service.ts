/**
 * mockBillingService — demo-track subscription data. The live counterpart
 * reads Stripe customer/subscription objects via the billing API routes.
 */
import type { PlanConfig, TenantPlan } from "@/lib/types";
// Plan definitions live in the admin mock (edited by /admin/plans); reading
// through it keeps one mutable store so live selectors can't diverge.
import { getPlanConfigsSync } from "./admin-service";
import { clone, delay } from "./delay";

export type PlanInfo = PlanConfig;

export interface Subscription {
  plan: TenantPlan;
  status: "active" | "trial" | "past_due";
  renewsAt: string; // ISO date
  paymentMethod: { brand: string; last4: string; expires: string };
}

export interface Invoice {
  id: string;
  date: string; // ISO
  amount: number;
  status: "paid" | "open";
}

let subscription: Subscription = {
  plan: "pro",
  status: "active",
  renewsAt: "2026-08-01",
  paymentMethod: { brand: "Visa", last4: "4242", expires: "09/28" },
};

const invoices: Invoice[] = [
  { id: "INV-2026-007", date: "2026-07-01", amount: 1.99, status: "paid" },
  { id: "INV-2026-006", date: "2026-06-01", amount: 1.99, status: "paid" },
  { id: "INV-2026-005", date: "2026-05-01", amount: 1.99, status: "paid" },
  { id: "INV-2026-004", date: "2026-04-01", amount: 0.99, status: "paid" },
  { id: "INV-2026-003", date: "2026-03-01", amount: 0.99, status: "paid" },
];

export const mockBillingService = {
  async listPlans(): Promise<PlanInfo[]> {
    await delay(200);
    return getPlanConfigsSync();
  },

  async getSubscription(): Promise<Subscription> {
    await delay(300);
    return clone(subscription);
  },

  async listInvoices(): Promise<Invoice[]> {
    await delay(300);
    return clone(invoices);
  },

  async changePlan(plan: TenantPlan): Promise<Subscription> {
    await delay(700);
    subscription = { ...subscription, plan };
    return clone(subscription);
  },
};
