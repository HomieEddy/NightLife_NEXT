import { mockEventsService } from "@/lib/mock-services/events-service";
import { liveEventsService } from "@/lib/live-services/events-service";
import { isDemoMode } from "@/lib/app-mode";

export type EventsService = typeof mockEventsService;

export const eventsService: EventsService = isDemoMode()
  ? mockEventsService
  : liveEventsService;
