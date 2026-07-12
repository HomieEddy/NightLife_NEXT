import {
  mockReportService,
  REPORT_METRICS,
} from "@/lib/mock-services/report-service";
export type { ReportMetric, SavedReport } from "@/lib/mock-services/report-service";

export type ReportService = typeof mockReportService;

export const reportService: ReportService = mockReportService;
export { REPORT_METRICS };
