import { mockBillingService } from "@/features/platform/billing-mock-service";
import { liveBillingService } from "@/features/platform/billing-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";
export type { Invoice, Subscription, PlanInfo } from "@/features/platform/billing-mock-service";

export type BillingService = typeof mockBillingService;

export const billingService: BillingService = isDemoMode()
  ? demoOnlyService(mockBillingService)
  : liveOnlyService(liveBillingService);
