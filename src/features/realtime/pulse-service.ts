import { mockPulseService } from "@/features/realtime/pulse-mock-service";
import { livePulseService } from "@/features/realtime/pulse-live-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type PulseService = typeof mockPulseService;

export const pulseService: PulseService = isDemoMode()
  ? mockPulseService
  : livePulseService;
