import { mockEventsService } from "@/lib/mock-services/events-service";

export type EventsService = typeof mockEventsService;

export const eventsService: EventsService = mockEventsService;
