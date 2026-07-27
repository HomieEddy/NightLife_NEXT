import { mockTipsService } from "@/lib/mock-services/tips-service";
import { liveTipsService } from "@/lib/live-services/tips-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type TipsService = typeof mockTipsService;

export const tipsService: TipsService = isDemoMode()
  ? demoOnlyService(mockTipsService)
  : liveOnlyService(liveTipsService);
