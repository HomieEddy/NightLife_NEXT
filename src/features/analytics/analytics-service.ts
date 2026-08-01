import {
  mockAnalyticsService,
} from "@/features/analytics/analytics-mock-service";
import { aggregateWeekly } from "@/lib/analytics";
import { liveAnalyticsService } from "@/features/analytics/analytics-live-service";
import { isDemoMode } from "@/features/shared/app-mode";
export type { HistoricalAnalytics } from "@/lib/types";

export type AnalyticsService = typeof mockAnalyticsService;

export const analyticsService: AnalyticsService = isDemoMode()
  ? mockAnalyticsService
  : liveAnalyticsService;
export { aggregateWeekly };
