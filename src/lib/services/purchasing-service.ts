import { mockPurchasingService } from "@/lib/mock-services/purchasing-service";
import { livePurchasingService } from "@/lib/live-services/purchasing-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type PurchasingService = typeof mockPurchasingService;

export const purchasingService: PurchasingService = isDemoMode()
  ? demoOnlyService(mockPurchasingService)
  : liveOnlyService(livePurchasingService);
