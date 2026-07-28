import { mockPromotionsService } from "@/features/hospitality/promotions-mock-service";
import { livePromotionsService } from "@/features/hospitality/promotions-live-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type PromotionsService = typeof mockPromotionsService;

export const promotionsService: PromotionsService = isDemoMode()
  ? mockPromotionsService
  : livePromotionsService;
