import { mockAutomationService } from "@/lib/mock-services/automation-service";
import { liveAutomationService } from "@/lib/live-services/automation-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type AutomationService = typeof mockAutomationService;

export const automationService: AutomationService = isDemoMode()
  ? mockAutomationService
  : liveAutomationService;
