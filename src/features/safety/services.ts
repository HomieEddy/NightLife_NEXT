import { mockIncidentService } from "@/features/safety/mock-service";
import { liveIncidentService } from "@/features/safety/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type IncidentService = typeof mockIncidentService;

export const incidentService: IncidentService = isDemoMode()
  ? demoOnlyService(mockIncidentService)
  : liveOnlyService(liveIncidentService);
