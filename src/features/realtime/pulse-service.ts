import { mockPulseService } from "@/features/realtime/pulse-mock-service";
import { livePulseService } from "@/features/realtime/pulse-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type PulseService = typeof mockPulseService;

export const pulseService: PulseService = isDemoMode()
  ? demoOnlyService(mockPulseService)
  : liveOnlyService(livePulseService);
