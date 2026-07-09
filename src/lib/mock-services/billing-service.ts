/**
 * mockBillingService — future backend boundary for the venue's SaaS subscription.
 * TODO(backend): Stripe customer + subscription objects; invoices from Stripe API.
 */
import type { TenantPlan } from "@/lib/types";
import { clone, delay } from "./delay";

export interface PlanInfo {
  id: TenantPlan;
  name: string;
  monthlyPrice: number;
  tableLimit: number | null; // null = unlimited
  staffLimit: number | null;
  features: string[];
}

export const PLANS: PlanInfo[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 99,
    tableLimit: 10,
    staffLimit: 5,
    features: ["QR ordering", "Basic menu & inventory", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 249,
    tableLimit: 40,
    staffLimit: 25,
    features: [
      "Everything in Starter",
      "Zones, floor map & scheduling",
      "Full analytics",
      "Happy hour engine",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 599,
    tableLimit: null,
    staffLimit: null,
    features: [
      "Everything in Pro",
      "Multi-venue management",
      "Custom integrations & API",
      "Dedicated success manager",
    ],
  },
];

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
  { id: "INV-2026-007", date: "2026-07-01", amount: 249, status: "paid" },
  { id: "INV-2026-006", date: "2026-06-01", amount: 249, status: "paid" },
  { id: "INV-2026-005", date: "2026-05-01", amount: 249, status: "paid" },
  { id: "INV-2026-004", date: "2026-04-01", amount: 99, status: "paid" },
  { id: "INV-2026-003", date: "2026-03-01", amount: 99, status: "paid" },
];

export const mockBillingService = {
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
