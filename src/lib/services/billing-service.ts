import { mockBillingService } from "@/lib/mock-services/billing-service";
export type { Invoice, Subscription, PlanInfo } from "@/lib/mock-services/billing-service";

export type BillingService = typeof mockBillingService;

export const billingService: BillingService = mockBillingService;
