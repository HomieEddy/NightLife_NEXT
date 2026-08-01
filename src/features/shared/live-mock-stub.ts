import { assertDemoMode } from "@/features/shared/app-mode";

const mockService = new Proxy({}, {
  get() {
    assertDemoMode();
    throw new Error("Mock services are unavailable in the live build");
  },
});

export const mockAdminService = mockService;
export const mockAnalyticsService = mockService;
export const mockAuthService = mockService;
export const mockBillingService = mockService;
export const mockEventsService = mockService;
export const mockGuestsService = mockService;
export const mockMenuService = mockService;
export const mockOrdersService = mockService;
export const mockPromotionsService = mockService;
export const mockPulseService = mockService;
export const mockReportService = mockService;
export const mockReservationService = mockService;
export const mockShowQueueService = mockService;
export const mockStaffService = mockService;
export const mockVenueService = mockService;

// Plan 10 owns moving plan configuration into the live product surface.
export function getPlanConfigsSync(): never {
  assertDemoMode();
  throw new Error("Mock services are unavailable in the live build");
}
