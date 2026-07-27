import { mockAuditService } from "@/lib/mock-services/audit-service";
import { liveAuditService } from "@/lib/live-services/audit-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type AuditService = typeof mockAuditService;

export const auditService: AuditService = isDemoMode()
  ? demoOnlyService(mockAuditService)
  : liveOnlyService(liveAuditService);
