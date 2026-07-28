import { mockAuditService } from "@/features/platform/audit-mock-service";
import { liveAuditService } from "@/lib/live-services/audit-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type AuditService = typeof mockAuditService;

export const auditService: AuditService = isDemoMode()
  ? demoOnlyService(mockAuditService)
  : liveOnlyService(liveAuditService);
