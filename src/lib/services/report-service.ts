import {
  mockReportService,
  REPORT_METRICS,
} from "@/lib/mock-services/report-service";
import { liveReportService } from "@/lib/live-services/report-service";
import { isDemoMode } from "@/lib/app-mode";
export type { ReportMetric, SavedReport } from "@/lib/types";

export type ReportService = typeof mockReportService;

export const reportService: ReportService = isDemoMode()
  ? mockReportService
  : liveReportService;
export { REPORT_METRICS };
