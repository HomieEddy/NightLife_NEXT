import {
  mockAnalyticsService,
  aggregateWeekly,
} from "@/lib/mock-services/analytics-service";
import { liveAnalyticsService } from "@/lib/live-services/analytics-service";
import { isDemoMode } from "@/lib/app-mode";
export type { HistoricalAnalytics } from "@/lib/mock-services/analytics-service";

export type AnalyticsService = typeof mockAnalyticsService;

export const analyticsService: AnalyticsService = isDemoMode()
  ? mockAnalyticsService
  : liveAnalyticsService;
export { aggregateWeekly };
