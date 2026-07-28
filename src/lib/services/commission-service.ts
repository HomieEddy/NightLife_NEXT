import { mockCommissionService } from "@/lib/mock-services/commission-service";
import { liveCommissionService } from "@/lib/live-services/commission-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type CommissionService = typeof mockCommissionService;

export const commissionService: CommissionService = isDemoMode()
  ? demoOnlyService(mockCommissionService)
  : liveOnlyService(liveCommissionService);
