import { mockPromotionsService } from "@/lib/mock-services/promotions-service";
import { livePromotionsService } from "@/lib/live-services/promotions-service";
import { isDemoMode } from "@/lib/app-mode";

export type PromotionsService = typeof mockPromotionsService;

export const promotionsService: PromotionsService = isDemoMode()
  ? mockPromotionsService
  : livePromotionsService;
