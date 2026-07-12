import { mockPulseService } from "@/lib/mock-services/pulse-service";

export type PulseService = typeof mockPulseService;

export const pulseService: PulseService = mockPulseService;
