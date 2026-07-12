import { mockPromotionsService } from "@/lib/mock-services/promotions-service";

export type PromotionsService = typeof mockPromotionsService;

export const promotionsService: PromotionsService = mockPromotionsService;
