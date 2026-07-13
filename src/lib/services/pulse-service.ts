import { mockPulseService } from "@/lib/mock-services/pulse-service";
import { livePulseService } from "@/lib/live-services/pulse-service";
import { isDemoMode } from "@/lib/app-mode";

export type PulseService = typeof mockPulseService;

export const pulseService: PulseService = isDemoMode()
  ? mockPulseService
  : livePulseService;
