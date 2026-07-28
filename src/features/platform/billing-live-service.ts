"use client";

import type { PlanConfig, TenantPlan } from "@/lib/types";
import type { Invoice, Subscription } from "@/features/platform/billing-mock-service";
import { liveFetch } from "@/features/shared/live-fetch";

export type PlanInfo = PlanConfig;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveBillingService = {
  async listPlans(): Promise<PlanInfo[]> {
    return api<PlanInfo[]>("/api/billing/plans");
  },
  async getSubscription(): Promise<Subscription> {
    return api<Subscription>("/api/billing/subscription");
  },
  async listInvoices(): Promise<Invoice[]> {
    return api<Invoice[]>("/api/billing/invoices");
  },
  async changePlan(plan: TenantPlan): Promise<Subscription> {
    return api<Subscription>("/api/billing/subscription", {
      method: "PATCH",
      body: JSON.stringify({ plan }),
    });
  },
};
