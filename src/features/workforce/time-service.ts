import { mockTimeService } from "@/features/workforce/time-mock-service";
import { liveTimeService } from "@/features/workforce/time-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type TimeService = typeof mockTimeService;

export const timeService: TimeService = isDemoMode()
  ? demoOnlyService(mockTimeService)
  : liveOnlyService(liveTimeService);
