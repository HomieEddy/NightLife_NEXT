import { mockChecklistService } from "@/features/venue/checklist-mock-service";
import { liveChecklistService } from "@/features/venue/checklist-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type ChecklistService = typeof mockChecklistService;

export const checklistService: ChecklistService = isDemoMode()
  ? demoOnlyService(mockChecklistService)
  : liveOnlyService(liveChecklistService);
