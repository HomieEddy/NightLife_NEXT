import { mockCertificationService } from "@/lib/mock-services/certification-service";
import { demoOnlyService, isDemoMode } from "@/features/shared/app-mode";

export type CertificationService = typeof mockCertificationService;

// ponytail: certification-service has no live selector yet — live graduation
// happens when plan 17 ships its real implementation (satisfies mock type).
// Until then, both builds hit the mock (cert data is demo-scoped).
export const certificationService: CertificationService = isDemoMode()
  ? demoOnlyService(mockCertificationService)
  : demoOnlyService(mockCertificationService);
