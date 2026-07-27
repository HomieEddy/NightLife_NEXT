import { mockDoorService } from "@/lib/mock-services/door-service";
import { liveDoorService } from "@/lib/live-services/door-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type DoorService = typeof mockDoorService;

export const doorService: DoorService = isDemoMode()
  ? demoOnlyService(mockDoorService)
  : liveOnlyService(liveDoorService);
