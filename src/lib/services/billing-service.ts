import { mockBillingService } from "@/lib/mock-services/billing-service";
import { liveBillingService } from "@/lib/live-services/billing-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";
export type { Invoice, Subscription, PlanInfo } from "@/lib/mock-services/billing-service";

export type BillingService = typeof mockBillingService;

export const billingService: BillingService = isDemoMode()
  ? demoOnlyService(mockBillingService)
  : liveOnlyService(liveBillingService);
