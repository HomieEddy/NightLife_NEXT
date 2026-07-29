import { mockAuditService } from "@/features/platform/audit-mock-service";
import { liveAuditService } from "@/features/platform/audit-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type AuditService = typeof mockAuditService;

export const auditService: AuditService = isDemoMode()
  ? demoOnlyService(mockAuditService)
  : liveOnlyService(liveAuditService);
