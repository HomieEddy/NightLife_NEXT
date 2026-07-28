export const JobType = {
  NightlyRollup: "nightly-rollup",
  ReservationReminders: "reservation-reminders",
  ReportSchedules: "report-schedules",
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export type NightlyRollupPayload = { venueId: string; nightLabel: string };
export type ReservationRemindersPayload = { venueId: string };
export type ReportSchedulesPayload = { venueId: string };
export type JobPayload = NightlyRollupPayload | ReservationRemindersPayload | ReportSchedulesPayload;
