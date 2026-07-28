import { mockCashoutService } from "@/lib/mock-services/cashout-service";
import { liveCashoutService } from "@/lib/live-services/cashout-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type CashoutService = typeof mockCashoutService;

export const cashoutService: CashoutService = isDemoMode()
  ? demoOnlyService(mockCashoutService)
  : liveOnlyService(liveCashoutService);
