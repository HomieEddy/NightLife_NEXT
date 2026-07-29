import { mockEventsService } from "@/features/hospitality/events-mock-service";
import { liveEventsService } from "@/features/hospitality/events-live-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type EventsService = typeof mockEventsService;

export const eventsService: EventsService = isDemoMode()
  ? mockEventsService
  : liveEventsService;
