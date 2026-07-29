import {
  mockReportService,
} from "@/features/analytics/report-mock-service";
import { REPORT_METRICS } from "@/lib/types";
import { liveReportService } from "@/features/analytics/report-live-service";
import { isDemoMode } from "@/features/shared/app-mode";
export type { ReportMetric, SavedReport } from "@/lib/types";

export type ReportService = typeof mockReportService;

export const reportService: ReportService = isDemoMode()
  ? mockReportService
  : liveReportService;
export { REPORT_METRICS };
