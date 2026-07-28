import { mockTimeService } from "@/lib/mock-services/time-service";
import { liveTimeService } from "@/lib/live-services/time-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type TimeService = typeof mockTimeService;

export const timeService: TimeService = isDemoMode()
  ? demoOnlyService(mockTimeService)
  : liveOnlyService(liveTimeService);
