import { mockAutomationService } from "@/features/automation/mock-service";
import { liveAutomationService } from "@/features/automation/live-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type AutomationService = typeof mockAutomationService;

export const automationService: AutomationService = isDemoMode()
  ? mockAutomationService
  : liveAutomationService;
