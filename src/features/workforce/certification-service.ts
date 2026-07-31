import { mockCertificationService } from "@/features/workforce/certification-mock-service";
import { liveCertificationService } from "@/features/workforce/certification-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type CertificationService = typeof mockCertificationService;

export const certificationService: CertificationService = isDemoMode()
  ? demoOnlyService(mockCertificationService)
  : liveOnlyService(liveCertificationService);
