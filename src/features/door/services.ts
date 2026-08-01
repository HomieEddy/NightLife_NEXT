import { mockDoorService } from "@/features/door/mock-service";
import { liveDoorService } from "@/features/door/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type DoorService = typeof mockDoorService;

export const doorService: DoorService = isDemoMode()
  ? demoOnlyService(mockDoorService)
  : liveOnlyService(liveDoorService);
