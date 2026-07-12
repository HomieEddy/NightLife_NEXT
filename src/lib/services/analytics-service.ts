import {
  mockAnalyticsService,
  aggregateWeekly,
} from "@/lib/mock-services/analytics-service";
export type { HistoricalAnalytics } from "@/lib/mock-services/analytics-service";

export type AnalyticsService = typeof mockAnalyticsService;

export const analyticsService: AnalyticsService = mockAnalyticsService;
export { aggregateWeekly };
