import { mockIncidentService } from "@/lib/mock-services/incident-service";
import { liveIncidentService } from "@/lib/live-services/incident-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type IncidentService = typeof mockIncidentService;

export const incidentService: IncidentService = isDemoMode()
  ? demoOnlyService(mockIncidentService)
  : liveOnlyService(liveIncidentService);
