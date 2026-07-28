import { mockPurchasingService } from "@/features/platform/purchasing-mock-service";
import { livePurchasingService } from "@/features/platform/purchasing-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type PurchasingService = typeof mockPurchasingService;

export const purchasingService: PurchasingService = isDemoMode()
  ? demoOnlyService(mockPurchasingService)
  : liveOnlyService(livePurchasingService);
