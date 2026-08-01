import { mockTipsService } from "@/features/workforce/tips-mock-service";
import { liveTipsService } from "@/features/workforce/tips-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type TipsService = typeof mockTipsService;

export const tipsService: TipsService = isDemoMode()
  ? demoOnlyService(mockTipsService)
  : liveOnlyService(liveTipsService);
