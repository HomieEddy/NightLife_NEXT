import { mockCashoutService } from "@/features/platform/cashout-mock-service";
import { liveCashoutService } from "@/features/platform/cashout-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type CashoutService = typeof mockCashoutService;

export const cashoutService: CashoutService = isDemoMode()
  ? demoOnlyService(mockCashoutService)
  : liveOnlyService(liveCashoutService);
