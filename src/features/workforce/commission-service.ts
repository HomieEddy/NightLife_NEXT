import { mockCommissionService } from "@/features/workforce/commission-mock-service";
import { liveCommissionService } from "@/features/workforce/commission-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type CommissionService = typeof mockCommissionService;

export const commissionService: CommissionService = isDemoMode()
  ? demoOnlyService(mockCommissionService)
  : liveOnlyService(liveCommissionService);
